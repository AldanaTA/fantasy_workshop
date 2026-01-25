import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dices, X } from 'lucide-react';
import { DiceRoll } from '../types/game';

interface DiceRollerProps {
  onRoll?: (roll: DiceRoll) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialFormula?: string;
}

export function DiceRoller({ onRoll, open, onOpenChange, initialFormula }: DiceRollerProps) {
  const [formula, setFormula] = useState(initialFormula || '1d20');
  const [history, setHistory] = useState<DiceRoll[]>([]);

  useEffect(() => {
    if (initialFormula) {
      setFormula(initialFormula);
    }
  }, [initialFormula]);

  const parseDiceFormula = (formula: string): { result: number; breakdown: string } => {
    try {
      // Parse formula like "2d6+3" or "1d20"
      const parts = formula.toLowerCase().replace(/\s/g, '').match(/(\d+)d(\d+)([+-]\d+)?/);
      if (!parts) throw new Error('Invalid formula');

      const numDice = parseInt(parts[1]);
      const numSides = parseInt(parts[2]);
      const modifier = parts[3] ? parseInt(parts[3]) : 0;

      let total = 0;
      const rolls: number[] = [];
      
      for (let i = 0; i < numDice; i++) {
        const roll = Math.floor(Math.random() * numSides) + 1;
        rolls.push(roll);
        total += roll;
      }

      const finalTotal = total + modifier;
      const breakdown = modifier !== 0 
        ? `[${rolls.join(', ')}] ${modifier >= 0 ? '+' : ''}${modifier} = ${finalTotal}`
        : `[${rolls.join(', ')}] = ${finalTotal}`;

      return { result: finalTotal, breakdown };
    } catch {
      return { result: 0, breakdown: 'Invalid formula' };
    }
  };

  const handleRoll = () => {
    const { result, breakdown } = parseDiceFormula(formula);
    const roll: DiceRoll = {
      formula,
      result,
      breakdown,
      timestamp: Date.now(),
    };

    setHistory([roll, ...history]);
    if (onRoll) {
      onRoll(roll);
    }
  };

  // If open/onOpenChange are provided, render as dialog
  if (open !== undefined && onOpenChange) {
    if (!open) return null;

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Dices className="w-5 h-5" />
                Dice Roller
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g., 2d6+3"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRoll();
                }}
              />
              <Button onClick={handleRoll}>
                <Dices className="w-4 h-4 mr-2" />
                Roll
              </Button>
            </div>

            {history.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">History</h3>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {history.map((roll, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-muted rounded text-sm"
                    >
                      <div className="font-medium">{roll.formula}</div>
                      <div className="text-xs text-muted-foreground">
                        {roll.breakdown}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default render as standalone component
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Dices className="w-5 h-5" />
          Dice Roller
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="e.g., 2d6+3"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRoll();
            }}
          />
          <Button onClick={handleRoll}>
            <Dices className="w-4 h-4 mr-2" />
            Roll
          </Button>
        </div>

        {history.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">History</h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {history.map((roll, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-muted rounded text-sm"
                >
                  <div className="font-medium">{roll.formula}</div>
                  <div className="text-xs text-muted-foreground">
                    {roll.breakdown}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
