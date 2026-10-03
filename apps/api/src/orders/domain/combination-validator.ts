export const CombinationErrorCode = {
  COMBINATION_QUANTITY_MISMATCH: 'COMBINATION_QUANTITY_MISMATCH',
  REQUIRED_OPTION_GROUP_MISSING: 'REQUIRED_OPTION_GROUP_MISSING',
  INVALID_OPTION_FOR_GROUP: 'INVALID_OPTION_FOR_GROUP',
  DUPLICATE_GROUP_SELECTION: 'DUPLICATE_GROUP_SELECTION',
  MINIMUM_ORDER_QUANTITY_NOT_MET: 'MINIMUM_ORDER_QUANTITY_NOT_MET',
  INVALID_LINE_QUANTITY: 'INVALID_LINE_QUANTITY',
  INVALID_COMBINATION_QUANTITY: 'INVALID_COMBINATION_QUANTITY',
} as const;

export type CombinationErrorCode =
  (typeof CombinationErrorCode)[keyof typeof CombinationErrorCode];

export class CombinationValidationError extends Error {
  constructor(
    public readonly code: CombinationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CombinationValidationError';
  }
}

export interface CombinationOptionGroup {
  id: string;
  isRequired: boolean;
  allowPortions: boolean;
  optionIds: ReadonlySet<string> | readonly string[];
}

export interface CombinationSelection {
  optionGroupId: string;
  optionId: string;
}

export interface LineCombination {
  quantity: number;
  selections: readonly CombinationSelection[];
}

export interface CombinationValidationInput {
  lineQuantity: number;
  minimumOrderQuantity?: number | null;
  optionGroups: readonly CombinationOptionGroup[];
  combinations: readonly LineCombination[];
}

export class CombinationValidator {
  validate(input: CombinationValidationInput): void {
    this.validateLineQuantity(input.lineQuantity);
    this.validateMinimumQuantity(input.lineQuantity, input.minimumOrderQuantity);

    const groups = new Map(input.optionGroups.map((group) => [group.id, group]));
    let combinationQuantity = 0;

    for (const combination of input.combinations) {
      this.validateCombinationQuantity(combination.quantity);
      combinationQuantity += combination.quantity;
      this.validateSelections(combination.selections, groups);
    }

    if (combinationQuantity !== input.lineQuantity) {
      throw new CombinationValidationError(
        CombinationErrorCode.COMBINATION_QUANTITY_MISMATCH,
        `Combination quantity total ${combinationQuantity} must equal line quantity ${input.lineQuantity}`,
      );
    }
  }

  private validateLineQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new CombinationValidationError(
        CombinationErrorCode.INVALID_LINE_QUANTITY,
        'Line quantity must be a positive integer',
      );
    }
  }

  private validateCombinationQuantity(quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new CombinationValidationError(
        CombinationErrorCode.INVALID_COMBINATION_QUANTITY,
        'Every combination quantity must be a positive integer',
      );
    }
  }

  private validateMinimumQuantity(
    lineQuantity: number,
    minimumOrderQuantity: number | null | undefined,
  ): void {
    if (
      minimumOrderQuantity != null &&
      (!Number.isInteger(minimumOrderQuantity) || minimumOrderQuantity < 0)
    ) {
      throw new CombinationValidationError(
        CombinationErrorCode.MINIMUM_ORDER_QUANTITY_NOT_MET,
        'Minimum order quantity must be a non-negative integer',
      );
    }

    if (minimumOrderQuantity != null && lineQuantity < minimumOrderQuantity) {
      throw new CombinationValidationError(
        CombinationErrorCode.MINIMUM_ORDER_QUANTITY_NOT_MET,
        `Line quantity ${lineQuantity} is below minimum order quantity ${minimumOrderQuantity}`,
      );
    }
  }

  private validateSelections(
    selections: readonly CombinationSelection[],
    groups: ReadonlyMap<string, CombinationOptionGroup>,
  ): void {
    const selectedGroups = new Set<string>();

    for (const selection of selections) {
      const group = groups.get(selection.optionGroupId);
      if (!group || !this.hasOption(group.optionIds, selection.optionId)) {
        throw new CombinationValidationError(
          CombinationErrorCode.INVALID_OPTION_FOR_GROUP,
          `Option ${selection.optionId} does not belong to option group ${selection.optionGroupId}`,
        );
      }

      if (selectedGroups.has(selection.optionGroupId) && !group.allowPortions) {
        throw new CombinationValidationError(
          CombinationErrorCode.DUPLICATE_GROUP_SELECTION,
          `Option group ${selection.optionGroupId} was selected more than once`,
        );
      }

      selectedGroups.add(selection.optionGroupId);
    }

    for (const group of groups.values()) {
      if (group.isRequired && !selectedGroups.has(group.id)) {
        throw new CombinationValidationError(
          CombinationErrorCode.REQUIRED_OPTION_GROUP_MISSING,
          `Required option group ${group.id} is missing`,
        );
      }
    }
  }

  private hasOption(
    optionIds: ReadonlySet<string> | readonly string[],
    optionId: string,
  ): boolean {
    if (optionIds instanceof Set) {
      return optionIds.has(optionId);
    }

    return (optionIds as readonly string[]).includes(optionId);
  }
}
