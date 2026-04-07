export type UserRole = 'creator' | 'gm' | 'player';

export interface ContentCategoryDefinition {
  id: string;
  name: string;
  parentId?: string; // For sub-categories
  createdAt: string;
  // Category settings
  appearOnCharacterSheet?: boolean; // Whether content in this category appears on character sheet by default
  // Category as content - categories can have their own fields
  fields?: ContentField[]; // Optional fields that apply to the category itself
}

// Simplified field types: numeric, string, or content reference
export interface ContentField {
  id: string;
  name: string;
  label?: string; // Optional display label (if not set, uses name)
  type: 'numeric' | 'string' | 'content' | 'content_list';
  // For numeric fields
  defaultValue?: number | string; // Can be a number or formula (e.g., "{Strength} * 2")
  minValue?: number | string; // Can be a number or formula
  maxValue?: number | string; // Can be a number or formula
  formula?: string; // Optional formula for numeric fields (e.g., "{Strength} + {Dexterity}")
  // For content reference fields
  allowedCategoryId?: string; // Which category content must be from
  renderDepth?: number; // How many layers deep to render nested content (default: 2, max: 5)
  // For content_list fields
  maxItems?: number; // Maximum number of items in the list (optional)
  slotLabel?: string; // Label for slots (e.g., "Slot" -> "Slot 1", "Slot 2", etc.)
  // Built-in mechanic reference
  mechanicType?: 'roll_die' | 'roll_for_success' | 'spend_resource'; // Built-in mechanic types
  rollFormula?: string; // For roll_die mechanic (e.g., "1d20", "2d6+3")
  successCriteria?: SuccessCriterion[]; // For roll_for_success mechanic
  spendResources?: SpendResourceEntry[]; // For spend_resource mechanic (can spend/change multiple resources)
  // Field editability
  editable?: boolean; // If true, field can be edited by players even in read-only mode
}

export interface SuccessCriterion {
  id: string;
  formula: string; // e.g., "1d100 < {Skill.Dodge}", "1d20 + {Strength} >= 15"
  label: string; // e.g., "Normal Success", "Critical Success", "Failure"
  order: number; // For ordering (lower numbers checked first)
  truncate?: boolean; // If true, truncate dice rolls; otherwise round them
}

export interface SpendResourceEntry {
  id: string;
  resourcePath: string; // e.g., "{Character_Sheet.Resource.MP}"
  amountFormula: string; // e.g., "11" or "5*{fireball.level}"
  fieldToChange?: string; // Optional: e.g., "{fireball.level}" - field to modify
  changeAmount?: string; // Optional: e.g., "+1" or "-1" - amount to change the field by
}

// Game Mechanics are content themselves
export interface GameMechanic {
  id: string;
  gameId: string;
  name: string;
  description: string; // Markdown formatted
  type: 'dice_roll' | 'formula' | 'content_search';
  category: string; // Category ID
  // For dice roll mechanics
  diceFormula?: string; // e.g., "2d6+3" or "1d20+{Strength}"
  // For formula mechanics  
  formula?: string; // e.g., "{Strength} + {Dexterity}"
  // For content search mechanics
  searchCategoryId?: string; // Which category to search in
  // Mechanics can be tied to content (show button on character sheet)
  tiedToContentIds: string[]; // Which content items this mechanic is tied to
  createdAt: string;
}

export interface DiceType {
  id: string;
  name: string;
  sides: number;
}

// Character instance of content
export interface CharacterContentInstance {
  id: string;
  contentId: string; // Reference to the Content definition
  fieldValues: Record<string, number | string | string[]>; // Values for each field (by field ID) - arrays for content_list
  notes?: string; // Optional notes for this instance
}

// Custom layout tab for character sheet
export interface CharacterSheetTab {
  id: string;
  name: string;
  contentIds: string[]; // Which content types to show in this tab
  collapsed?: boolean; // Whether this tab/section is collapsed
}


export interface DiceRoll {
  formula: string;
  result: number;
  breakdown: string;
  timestamp: number;
}