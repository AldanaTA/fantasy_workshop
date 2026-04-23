import type { Campaign, Game } from '../../api/models';
import { CampaignChatPanel } from '../campaigns/CampaignChatPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { GameMasterCampaignAllowedPacksView } from './GameMasterCampaignAllowedPacksView';
import { GameMasterCampaignFormView } from './GameMasterCampaignFormView';
import { GameMasterCampaignNotesView } from './GameMasterCampaignNotesView';
import { GameMasterCampaignValidationView } from './GameMasterCampaignValidationView';
import { GameMasterViewFrame } from './GameMasterViewFrame';

type Props = {
  campaign: Campaign;
  games: Game[];
  activeTab: 'details' | 'packs' | 'validation' | 'notes' | 'timeline';
  onTabChange: (tab: 'details' | 'packs' | 'validation' | 'notes' | 'timeline') => void;
  onBack: () => void;
  onSaved: (campaign: Campaign) => Promise<void> | void;
};

export function GameMasterCampaignManageView({
  campaign,
  games,
  activeTab,
  onTabChange,
  onBack,
  onSaved,
}: Props) {
  return (
    <GameMasterViewFrame
      title={`Manage ${campaign.name}`}
      description="Edit campaign details and switch between GM tools without leaving the selected campaign."
      onBack={onBack}
    >
      <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as typeof activeTab)} className="min-w-0">
        <div className="-mx-1 overflow-x-auto pb-1">
          <TabsList className="h-auto min-w-max gap-1 bg-muted/80 p-1">
            <TabsTrigger value="details" className="min-h-[44px] px-3">
              Edit Campaign
            </TabsTrigger>
            <TabsTrigger value="packs" className="min-h-[44px] px-3">
              Allowed Packs
            </TabsTrigger>
            <TabsTrigger value="validation" className="min-h-[44px] px-3">
              Validate
            </TabsTrigger>
            <TabsTrigger value="notes" className="min-h-[44px] px-3">
              Notes
            </TabsTrigger>
            <TabsTrigger value="timeline" className="min-h-[44px] px-3">
              Chat
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="details">
          <GameMasterCampaignFormView
            mode="edit"
            campaign={campaign}
            games={games}
            embedded
            onBack={onBack}
            onSaved={onSaved}
          />
        </TabsContent>

        <TabsContent value="packs">
          <GameMasterCampaignAllowedPacksView campaign={campaign} embedded />
        </TabsContent>

        <TabsContent value="validation">
          <GameMasterCampaignValidationView campaign={campaign} embedded />
        </TabsContent>

        <TabsContent value="notes">
          <GameMasterCampaignNotesView campaign={campaign} embedded />
        </TabsContent>

        <TabsContent value="timeline">
          <CampaignChatPanel campaign={campaign} accessRole="co_gm" />
        </TabsContent>
      </Tabs>
    </GameMasterViewFrame>
  );
}
