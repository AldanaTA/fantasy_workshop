import type { Campaign, Game } from '../../api/models';
import { GamePackWorkspace } from '../game_packs/GamePackWorkspace';

type Props = {
  campaign: Campaign;
  game?: Game | null;
  onBack?: () => void;
};

export function GameMasterCampaignGamePacksView({ campaign, game, onBack }: Props) {
  return <GamePackWorkspace mode="campaign" campaign={campaign} lockedGame={game ?? null} onBack={onBack} />;
}
