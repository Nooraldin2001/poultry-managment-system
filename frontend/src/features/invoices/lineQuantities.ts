/** Derive invoice line quantities from cartons for fixed-weight products. */

export type CartonCalculationInput = {
  weightGrams: number;
  piecesPerCarton: number;
  cartons: number;
  loosePieces?: number;
  productType?: string;
  kgOverride?: boolean;
  manualKg?: number;
};

export function calculateFixedWeightLine(input: CartonCalculationInput) {
  const weightKgPerPiece = input.weightGrams / 1000;
  const cartonPieces = input.cartons * input.piecesPerCarton;
  const totalPieces = cartonPieces + (input.loosePieces || 0);
  const totalKg = totalPieces * weightKgPerPiece;
  return {
    totalPieces,
    totalKg: Math.round(totalKg * 1000) / 1000,
    kgPerCarton: input.piecesPerCarton * weightKgPerPiece,
  };
}

export function deriveQuantitiesFromCartons(input: CartonCalculationInput): {
  cartons: number;
  pieces: number;
  kg: number;
} {
  const cartons = input.cartons || 0;
  const loosePieces = input.loosePieces || 0;
  const ppc = input.piecesPerCarton || 0;
  const grams = input.weightGrams || 0;
  const productType = input.productType ?? "fixed";

  if (input.kgOverride && input.manualKg != null) {
    const pieces = ppc > 0 ? cartons * ppc + loosePieces : loosePieces;
    return { cartons, pieces, kg: input.manualKg };
  }

  if (productType === "fixed" && grams > 0 && ppc > 0) {
    const calc = calculateFixedWeightLine(input);
    return { cartons, pieces: calc.totalPieces, kg: calc.totalKg };
  }

  if (ppc > 0) {
    const pieces = cartons * ppc + loosePieces;
    return { cartons, pieces, kg: input.manualKg ?? 0 };
  }

  return { cartons, pieces: loosePieces, kg: input.manualKg ?? 0 };
}
