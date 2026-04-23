import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

import { campaignsApi } from '../../api/campaignsApi';
import type { Campaign, CampaignCharacter, CampaignCharacterValidation, Character } from '../../api/models';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '../ui/card';
import { GameMasterViewFrame } from './GameMasterViewFrame';

type Props = {
  campaign: Campaign;
  onBack?: () => void;
  embedded?: boolean;
};

type ValidationRow = {
  campaignCharacter: CampaignCharacter;
  character: Character | null;
  validation: CampaignCharacterValidation | null;
  error?: string | null;
};

export function GameMasterCampaignValidationView({ campaign, onBack, embedded = false }: Props) {
  const [rows, setRows] = useState<ValidationRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadValidations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const campaignCharacters = await campaignsApi.listCampaignCharacters(campaign.id);
      const loadedRows = await Promise.all(
        campaignCharacters.map(async (campaignCharacter) => {
          try {
            const loadResult = await campaignsApi.loadCampaignCharacter(campaign.id, campaignCharacter.id);
            return {
              campaignCharacter,
              character: loadResult.character,
              validation: loadResult.validation,
            } satisfies ValidationRow;
          } catch (err) {
            let character: Character | null = null;
            try {
              character = await campaignsApi.getCharacter(campaignCharacter.character_id);
            } catch {
              character = null;
            }
            return {
              campaignCharacter,
              character,
              validation: null,
              error: (err as Error)?.message || 'Unable to validate character.',
            } satisfies ValidationRow;
          }
        }),
      );
      setRows(loadedRows);
    } catch (err) {
      setRows([]);
      setError((err as Error)?.message || 'Unable to load campaign character validations.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadValidations();
  }, [campaign.id]);

  const content = (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" variant="outline" onClick={() => void loadValidations()} className="min-h-[44px]">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>
      {isLoading ? (
        <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          Loading validations...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/50 bg-destructive/5 px-4 py-6 text-sm text-destructive">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background px-4 py-10 text-center text-sm text-muted-foreground">
          No campaign characters found to validate.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const warningCount = row.validation?.warnings.length ?? 0;
            const isValid = row.validation?.status === 'valid';

            return (
              <Card key={row.campaignCharacter.id} className="border-border">
                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-base">{row.character?.name ?? row.campaignCharacter.character_id}</CardTitle>
                      <CardDescription>
                        Character ID: {row.campaignCharacter.character_id}
                      </CardDescription>
                    </div>
                    <Badge variant={isValid ? 'default' : 'secondary'}>
                      {row.error ? 'Error' : isValid ? 'Valid' : `${warningCount} Warning${warningCount === 1 ? '' : 's'}`}
                    </Badge>
                  </div>

                  {row.error ? (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Validation could not be loaded</AlertTitle>
                      <AlertDescription>{row.error}</AlertDescription>
                    </Alert>
                  ) : row.validation?.warnings.length ? (
                    <div className="space-y-2">
                      {row.validation.warnings.map((warning, index) => (
                        <Alert key={`${row.campaignCharacter.id}-${warning.code}-${index}`}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertTitle>{warning.code}</AlertTitle>
                          <AlertDescription>
                            {warning.message}
                            {warning.reference_path ? ` (${warning.reference_path})` : ''}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  ) : (
                    <Alert>
                      <CheckCircle2 className="h-4 w-4" />
                      <AlertTitle>No validation warnings</AlertTitle>
                      <AlertDescription>This character only references allowed campaign content.</AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <GameMasterViewFrame
      title={`Validation for ${campaign.name}`}
      description="Review campaign character warnings without mixing this workflow into the general campaign list."
      onBack={onBack}
      actions={(
        <Button type="button" variant="outline" onClick={() => void loadValidations()} className="min-h-[44px]">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      )}
    >
      {content}
    </GameMasterViewFrame>
  );
}
