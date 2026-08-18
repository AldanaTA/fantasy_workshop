import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  Dices,
  Radio,
  Send,
} from 'lucide-react';

import { campaignsApi } from '../../api/campaignsApi';
import { authStore } from '../../api/authStorage';
import { chatApi } from '../../api/chatApi';
import type { Campaign, CampaignChatMessage, UserCampaignRole } from '../../api/models';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';
import { cn } from '../ui/utils';
import { useToast } from '../ui/toastProvider';

type CampaignAccessRole = 'owner' | 'co_gm' | 'player' | 'viewer';

type CampaignChatPanelProps = {
  campaign: Campaign;
  accessRole: CampaignAccessRole;
  className?: string;
};

type TimelineItem =
  {
    id: string;
    createdAt: string;
    kind: 'chat' | 'whisper' | 'roll';
    messageId: string;
    userId: string;
    message: string;
    whisperTo: string[];
    authorLabel: string;
    audienceLabel: string | null;
    rollSummary?: string | null;
  };

type ParticipantOption = {
  userId: string;
  label: string;
  roleLabel: string;
};

const CHAT_PAGE_SIZE = 30;
const RECONNECT_DELAY_MS = 2000;

export function CampaignChatPanel({ campaign, accessRole, className }: CampaignChatPanelProps) {
  const { toast } = useToast();
  const currentUserId = useMemo(() => {
    try {
      return authStore.getUserId();
    } catch {
      return null;
    }
  }, []);
  const currentDisplayName = authStore.getDisplayName()?.trim() || 'You';
  const canWriteChat = accessRole === 'owner' || accessRole === 'co_gm' || accessRole === 'player';

  const [chatMessages, setChatMessages] = useState<CampaignChatMessage[]>([]);
  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasMoreChat, setHasMoreChat] = useState(true);
  const [chatCursor, setChatCursor] = useState<{ beforeCreatedAt: string | null; beforeId: string | null }>({
    beforeCreatedAt: null,
    beforeId: null,
  });
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'live' | 'reconnecting'>('connecting');
  const [composerText, setComposerText] = useState('');
  const [composerTarget, setComposerTarget] = useState('public');
  const [rollExpression, setRollExpression] = useState('1d20');
  const [rollLabel, setRollLabel] = useState('');
  const [isSendingRoll, setIsSendingRoll] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const scrollRootRef = useRef<HTMLDivElement | null>(null);
  const didInitialScrollRef = useRef(false);
  const shouldAutoScrollRef = useRef(true);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);

  useEffect(() => {
    didInitialScrollRef.current = false;
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
  }, [campaign.id]);

  const participantMap = useMemo(() => {
    const map = new Map<string, ParticipantOption>();
    for (const participant of participants) {
      map.set(participant.userId, participant);
    }
    if (currentUserId && !map.has(currentUserId)) {
      map.set(currentUserId, {
        userId: currentUserId,
        label: currentDisplayName,
        roleLabel: accessRole === 'owner' ? 'Owner' : formatRoleLabel(accessRole),
      });
    }
    return map;
  }, [accessRole, currentDisplayName, currentUserId, participants]);

  const whisperOptions = useMemo(() => {
    if (!currentUserId) return participants;
    return participants.filter((participant) => participant.userId !== currentUserId);
  }, [currentUserId, participants]);

  const timelineItems = useMemo(() => {
    return chatMessages
      .map((message) => normalizeMessage(message, {
        currentUserId,
        currentDisplayName,
        participants: participantMap,
      }))
      .sort(sortTimelineItemsAsc);
  }, [chatMessages, currentDisplayName, currentUserId, participantMap]);

  useEffect(() => {
    let cancelled = false;

    const loadInitial = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [chatPage, roleRows] = await Promise.all([
          chatApi.listMessagesPage(campaign.id, CHAT_PAGE_SIZE),
          campaignsApi.listRoles(campaign.id).catch(() => [] as UserCampaignRole[]),
        ]);
        if (cancelled) return;

        setChatMessages(mergeById([], chatPage.items, (item) => item.id, compareByCreatedAtAsc));
        setChatCursor({
          beforeCreatedAt: chatPage.next_before_created_at ?? null,
          beforeId: chatPage.next_before_id ?? null,
        });
        setHasMoreChat(chatPage.items.length === CHAT_PAGE_SIZE);
        setParticipants(buildParticipants(campaign, roleRows, currentUserId, currentDisplayName, accessRole));
      } catch (err) {
        if (cancelled) return;
        setChatMessages([]);
        setParticipants(buildParticipants(campaign, [], currentUserId, currentDisplayName, accessRole));
        setLoadError((err as Error)?.message || 'Unable to load campaign chat.');
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, [accessRole, campaign, currentDisplayName, currentUserId]);

  useEffect(() => {
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      setSocketStatus((prev) => (prev === 'live' ? 'reconnecting' : 'connecting'));

      const socket = chatApi.connectCampaignChat(campaign.id);
      wsRef.current = socket;

      socket.onopen = () => {
        if (cancelled) return;
        setSocketStatus('live');
      };

      socket.onmessage = (event) => {
        const parsed = parseChatSocketPayload(event.data);
        if (!parsed) return;
        const shouldStickToBottom = shouldAutoScrollRef.current || isNearBottom(scrollRootRef.current);
        setChatMessages((prev) => mergeById(prev, [parsed], (item) => item.id, compareByCreatedAtAsc));
        if (shouldStickToBottom) {
          queueScrollToBottom(scrollRootRef.current);
        }
      };

      socket.onerror = () => {
        if (cancelled) return;
        setSocketStatus('reconnecting');
      };

      socket.onclose = () => {
        if (wsRef.current === socket) {
          wsRef.current = null;
        }
        if (cancelled) return;
        setSocketStatus('reconnecting');
        reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [campaign.id]);

  useEffect(() => {
    if (!isLoading && !didInitialScrollRef.current && timelineItems.length) {
      didInitialScrollRef.current = true;
      queueScrollToBottom(scrollRootRef.current);
    }
  }, [isLoading, timelineItems.length]);

  useEffect(() => {
    const viewport = getScrollViewport(scrollRootRef.current);
    if (!viewport) return;

    const handleScroll = () => {
      const nearBottom = isNearBottom(scrollRootRef.current);
      shouldAutoScrollRef.current = nearBottom;
      setShowJumpToLatest(!nearBottom);
    };

    handleScroll();
    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [isLoading, loadError, timelineItems.length]);

  const handleLoadOlder = async () => {
    if (isLoadingOlder || !hasMoreChat) return;

    const viewport = getScrollViewport(scrollRootRef.current);
    const previousScrollHeight = viewport?.scrollHeight ?? 0;

    setIsLoadingOlder(true);
    try {
      const chatPage = await chatApi.listMessagesPage(
        campaign.id,
        CHAT_PAGE_SIZE,
        chatCursor.beforeCreatedAt,
        chatCursor.beforeId,
      );

      if (chatPage) {
        setChatMessages((prev) => mergeById(prev, chatPage.items, (item) => item.id, compareByCreatedAtAsc));
        setChatCursor({
          beforeCreatedAt: chatPage.next_before_created_at ?? null,
          beforeId: chatPage.next_before_id ?? null,
        });
        setHasMoreChat(chatPage.items.length === CHAT_PAGE_SIZE);
      }

      window.requestAnimationFrame(() => {
        const nextViewport = getScrollViewport(scrollRootRef.current);
        if (!nextViewport) return;
        const nextScrollHeight = nextViewport.scrollHeight;
        nextViewport.scrollTop += nextScrollHeight - previousScrollHeight;
      });
    } catch (err) {
      toast({
        title: 'Unable to load older history',
        description: (err as Error)?.message || 'The older timeline page could not be loaded.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingOlder(false);
    }
  };

  const sendPayload = (payload: { message: string; whisper_to?: string[] }) => {
    const socket = wsRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      toast({
        title: 'Chat is reconnecting',
        description: 'Wait for the live chat connection to recover before sending a message.',
        variant: 'destructive',
      });
      return false;
    }

    socket.send(JSON.stringify(payload));
    shouldAutoScrollRef.current = true;
    setShowJumpToLatest(false);
    queueScrollToBottom(scrollRootRef.current);
    return true;
  };

  const handleSendMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWriteChat) return;

    const trimmed = composerText.trim();
    if (!trimmed) return;

    try {
      const payload = composerTarget === 'public'
        ? { message: trimmed }
        : { message: trimmed, whisper_to: [composerTarget] };
      const sent = sendPayload(payload);
      if (!sent) return;
      setComposerText('');
    } catch (err) {
      toast({
        title: 'Unable to send message',
        description: (err as Error)?.message || 'The message could not be sent.',
        variant: 'destructive',
      });
    }
  };

  const handleRoll = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWriteChat || isSendingRoll) return;

    const expression = rollExpression.trim();
    if (!expression) return;

    const result = evaluateDiceExpression(expression);
    if (!result.ok) {
      toast({
        title: 'Invalid roll',
        description: result.error,
        variant: 'destructive',
      });
      return;
    }

    setIsSendingRoll(true);
    try {
      const label = rollLabel.trim();
      const prefix = label ? `${label}: ` : '';
      const rollMessage = `[roll] ${prefix}${result.normalizedExpression} = ${result.total} (${result.breakdown})`;
      const payload = composerTarget === 'public'
        ? { message: rollMessage }
        : { message: rollMessage, whisper_to: [composerTarget] };
      const sent = sendPayload(payload);
      if (!sent) return;
      setRollLabel('');
    } finally {
      setIsSendingRoll(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('rounded-2xl border border-border bg-background p-3', className)}>
        <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Loading timeline...
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={cn('rounded-2xl border border-border bg-background p-3', className)}>
        <div className="rounded-2xl border border-destructive/50 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {loadError}
        </div>
      </div>
    );
  }

  const liveBadgeLabel = socketStatus === 'live'
    ? 'Chat Live'
    : socketStatus === 'connecting'
      ? 'Connecting'
      : 'Reconnecting';

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-sm', className)}>
      <div className="flex flex-col gap-2 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold">Campaign Chat</p>
          <p className="text-xs text-muted-foreground">
            Shared log for chat, whispers, and rolls.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={socketStatus === 'live' ? 'default' : 'secondary'}>
            <Radio className="h-3.5 w-3.5" />
            {liveBadgeLabel}
          </Badge>
          <Badge variant={canWriteChat ? 'secondary' : 'outline'}>
            {canWriteChat ? 'Write Enabled' : 'Read Only'}
          </Badge>
        </div>
      </div>
 
      <div className="flex flex-col">
        <div ref={scrollRootRef} className="relative">
          <ScrollArea className="h-[22rem] w-full sm:h-[24rem]">
            <div className="space-y-2 px-3 py-3 sm:px-4">
              {timelineItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                  No campaign chat history yet.
                </div>
              ) : (
                timelineItems.map((item) => (
                  <TimelineRow key={item.id} item={item} />
                ))
              )}
            </div>
          </ScrollArea>
          {showJumpToLatest ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center px-3">
              <Button
                type="button"
                size="sm"
                className="pointer-events-auto rounded-full shadow-md"
                onClick={() => {
                  shouldAutoScrollRef.current = true;
                  setShowJumpToLatest(false);
                  queueScrollToBottom(scrollRootRef.current);
                }}
              >
                <ArrowDown className="h-4 w-4" />
                Latest
              </Button>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 border-t border-border bg-muted/20 px-3 py-2.5 sm:px-4">
          <div className="flex flex-col gap-1.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="w-full lg:max-w-xs">
              <Select value={composerTarget} onValueChange={setComposerTarget} disabled={!canWriteChat}>
                <SelectTrigger className="min-h-[40px] bg-background">
                  <SelectValue placeholder="Choose audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public chat</SelectItem>
                  {whisperOptions.map((participant) => (
                    <SelectItem key={participant.userId} value={participant.userId}>
                      Whisper to {participant.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              {composerTarget === 'public'
                ? 'Public log entry'
                : `Private to ${participantMap.get(composerTarget)?.label ?? 'selected participant'}`}
            </p>
          </div>

          <form className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto]" onSubmit={handleSendMessage}>
            <Textarea
              value={composerText}
              onChange={(event) => setComposerText(event.target.value)}
              placeholder={canWriteChat ? 'Send a message...' : 'Viewers can read chat but cannot send messages.'}
              className="min-h-[44px] max-h-28 resize-y bg-background text-sm"
              disabled={!canWriteChat}
              maxLength={4000}
            />
            <Button
              type="submit"
              className="min-h-[40px] w-full px-3 sm:w-auto sm:self-end"
              disabled={!canWriteChat || !composerText.trim() || socketStatus !== 'live'}
            >
              <Send className="h-4 w-4" />
              Send
            </Button>
          </form>

          <form className="grid gap-1.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]" onSubmit={handleRoll}>
            <Input
              value={rollExpression}
              onChange={(event) => setRollExpression(event.target.value)}
              placeholder="Roll expression, e.g. 1d20+5"
              disabled={!canWriteChat}
              className="h-9 bg-background text-sm"
            />
            <Input
              value={rollLabel}
              onChange={(event) => setRollLabel(event.target.value)}
              placeholder="Optional label, e.g. Attack"
              disabled={!canWriteChat}
              className="h-9 bg-background text-sm"
            />
            <Button
              type="submit"
              variant="outline"
              className="h-9 w-full bg-background px-3 md:w-auto"
              disabled={!canWriteChat || !rollExpression.trim() || socketStatus !== 'live' || isSendingRoll}
            >
              <Dices className="h-4 w-4" />
              Roll
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const badgeLabel = item.kind === 'whisper' ? 'Whisper' : item.kind === 'roll' ? 'Roll' : 'Chat';

  return (
    <article
      className={cn(
        'rounded-lg px-2.5 py-2 text-sm',
        item.kind === 'whisper' && 'bg-amber-500/10',
        item.kind === 'roll' && 'bg-primary/10',
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-semibold text-foreground">{item.authorLabel}</span>
        <Badge variant={item.kind === 'chat' ? 'outline' : 'secondary'}>{badgeLabel}</Badge>
        {item.audienceLabel ? <span className="text-xs text-muted-foreground">{item.audienceLabel}</span> : null}
        <span className="text-xs text-muted-foreground">{formatTimelineTime(item.createdAt)}</span>
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words leading-6 text-foreground/90">
        {item.rollSummary ?? item.message}
      </p>
    </article>
  );
}

function normalizeMessage(
  message: CampaignChatMessage,
  options: {
    currentUserId: string | null;
    currentDisplayName: string;
    participants: Map<string, ParticipantOption>;
  },
): TimelineItem {
  const whisperTo = message.whisper_to ?? [];
  const author = getParticipantLabel(message.user_id, options.participants, options.currentUserId, options.currentDisplayName);
  const audienceLabel = whisperTo.length
    ? `to ${whisperTo.map((userId) => getParticipantLabel(userId, options.participants, options.currentUserId, options.currentDisplayName)).join(', ')}`
    : null;
  const parsedRoll = parseRollMessage(message.message);

  return {
    id: `chat:${message.id}`,
    createdAt: message.created_at,
    kind: parsedRoll ? 'roll' : whisperTo.length ? 'whisper' : 'chat',
    messageId: message.id,
    userId: message.user_id,
    message: parsedRoll ? parsedRoll.rawMessage : message.message,
    whisperTo,
    authorLabel: options.currentUserId === message.user_id ? `${author} (You)` : author,
    audienceLabel,
    rollSummary: parsedRoll?.summary ?? null,
  };
}

function parseRollMessage(message: string) {
  if (!message.startsWith('[roll] ')) return null;
  const rawMessage = message.slice('[roll] '.length).trim();
  return {
    rawMessage,
    summary: rawMessage,
  };
}

function evaluateDiceExpression(expression: string):
  | { ok: true; normalizedExpression: string; total: number; breakdown: string }
  | { ok: false; error: string } {
  const normalized = expression.replace(/\s+/g, '').toLowerCase();
  if (!normalized) {
    return { ok: false, error: 'Enter a dice expression like 1d20+5.' };
  }

  const validPattern = /^[+-]?(?:\d*d\d+|\d+)(?:[+-](?:\d*d\d+|\d+))*$/;
  if (!validPattern.test(normalized)) {
    return { ok: false, error: 'Supported rolls look like 1d20, 2d6+3, or d20+4-1.' };
  }

  const tokens = normalized.match(/[+-]?(?:\d*d\d+|\d+)/g);
  if (!tokens?.length) {
    return { ok: false, error: 'No dice terms were found in that expression.' };
  }

  let total = 0;
  const breakdownParts: string[] = [];

  for (const token of tokens) {
    const sign = token.startsWith('-') ? -1 : 1;
    const body = token.replace(/^[+-]/, '');

    if (body.includes('d')) {
      const [rawCount, rawSides] = body.split('d');
      const count = rawCount === '' ? 1 : Number(rawCount);
      const sides = Number(rawSides);

      if (!Number.isInteger(count) || !Number.isInteger(sides) || count < 1 || count > 100 || sides < 2 || sides > 1000) {
        return { ok: false, error: 'Dice rolls must stay within 1-100 dice and 2-1000 sides.' };
      }

      const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
      total += sign * rolls.reduce((sum, value) => sum + value, 0);
      breakdownParts.push(`${sign < 0 ? '-' : '+'}${count}d${sides}[${rolls.join(', ')}]`);
    } else {
      const value = Number(body);
      if (!Number.isFinite(value)) {
        return { ok: false, error: 'One of the numeric modifiers could not be read.' };
      }
      total += sign * value;
      breakdownParts.push(`${sign < 0 ? '-' : '+'}${value}`);
    }
  }

  return {
    ok: true,
    normalizedExpression: normalized.replace(/\b1d/g, 'd'),
    total,
    breakdown: breakdownParts.join(' ').replace(/^\+/, ''),
  };
}

function buildParticipants(
  campaign: Campaign,
  roles: UserCampaignRole[],
  currentUserId: string | null,
  currentDisplayName: string,
  accessRole: CampaignAccessRole,
): ParticipantOption[] {
  const map = new Map<string, ParticipantOption>();

  const push = (userId: string, label: string, roleLabel: string) => {
    map.set(userId, { userId, label, roleLabel });
  };

  push(
    campaign.owner_user_id,
    campaign.owner_user_id === currentUserId ? currentDisplayName : `Owner ${shortId(campaign.owner_user_id)}`,
    'Owner',
  );

  for (const role of roles) {
    if (role.user_id === campaign.owner_user_id) continue;
    const isCurrentUser = role.user_id === currentUserId;
    push(
      role.user_id,
      isCurrentUser ? currentDisplayName : `User ${shortId(role.user_id)}`,
      formatRoleLabel(role.role),
    );
  }

  if (currentUserId && !map.has(currentUserId)) {
    push(currentUserId, currentDisplayName, formatRoleLabel(accessRole));
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
}

function getParticipantLabel(
  userId: string,
  participants: Map<string, ParticipantOption>,
  currentUserId: string | null,
  currentDisplayName: string,
) {
  if (userId === currentUserId) return currentDisplayName;
  return participants.get(userId)?.label ?? `User ${shortId(userId)}`;
}

function compareByCreatedAtAsc<T extends { created_at: string; id: string }>(a: T, b: T) {
  const timeDiff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  if (timeDiff !== 0) return timeDiff;
  return a.id.localeCompare(b.id);
}

function sortTimelineItemsAsc(a: TimelineItem, b: TimelineItem) {
  const timeDiff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  if (timeDiff !== 0) return timeDiff;
  return a.id.localeCompare(b.id);
}

function mergeById<T>(
  existing: T[],
  incoming: T[],
  getId: (item: T) => string,
  sortItems: (a: T, b: T) => number,
) {
  const byId = new Map<string, T>();
  for (const item of existing) {
    byId.set(getId(item), item);
  }
  for (const item of incoming) {
    byId.set(getId(item), item);
  }
  return [...byId.values()].sort(sortItems);
}

function parseChatSocketPayload(data: string): CampaignChatMessage | null {
  try {
    const parsed = JSON.parse(data) as CampaignChatMessage;
    if (!parsed?.id || !parsed?.created_at) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getScrollViewport(root: HTMLDivElement | null) {
  return root?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLDivElement | null;
}

function isNearBottom(root: HTMLDivElement | null) {
  const viewport = getScrollViewport(root);
  if (!viewport) return true;
  return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 72;
}

function queueScrollToBottom(root: HTMLDivElement | null) {
  window.requestAnimationFrame(() => {
    const viewport = getScrollViewport(root);
    if (!viewport) return;
    viewport.scrollTop = viewport.scrollHeight;
  });
}

function shortId(value: string) {
  return value.slice(0, 8);
}

function formatRoleLabel(role: string) {
  if (role === 'co_gm') return 'Co-GM';
  if (role === 'owner') return 'Owner';
  if (role === 'player') return 'Player';
  if (role === 'viewer') return 'Viewer';
  return humanizeEventType(role);
}

function humanizeEventType(value: string) {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatTimelineTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
