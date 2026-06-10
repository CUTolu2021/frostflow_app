const Decimal = require('decimal.js');
const { HttpError } = require('./httpError');

const QUANTITY_SCALE = 3;
const MONEY_SCALE = 2;

const createDecimal = (value, fieldName = 'value') => {
  if (value === null || value === undefined || String(value).trim() === '') {
    throw new HttpError(400, `${fieldName} is required`);
  }

  try {
    return new Decimal(String(value).trim());
  } catch (error) {
    throw new HttpError(400, `${fieldName} must be a valid number`);
  }
};

const toScaledDecimal = (value, fieldName, scale, minimum = null) => {
  const decimal = createDecimal(value, fieldName);
  if (minimum !== null && decimal.lt(minimum)) {
    throw new HttpError(400, `${fieldName} must be ${minimum === 0 ? 'a non-negative number' : 'a positive number'}`);
  }
  return decimal.toDecimalPlaces(scale, Decimal.ROUND_HALF_UP);
};

const toPositiveQuantityDecimal = (value, fieldName = 'quantity') =>
  toScaledDecimal(value, fieldName, QUANTITY_SCALE, new Decimal(0.001));

const toNonNegativeQuantityDecimal = (value, fieldName = 'quantity') =>
  toScaledDecimal(value, fieldName, QUANTITY_SCALE, 0);

const toNonNegativeMoneyDecimal = (value, fieldName = 'amount') =>
  toScaledDecimal(value, fieldName, MONEY_SCALE, 0);

const toNumber = (decimal) => decimal.toNumber();

module.exports = {
  Decimal,
  createDecimal,
  toPositiveQuantityDecimal,
  toNonNegativeQuantityDecimal,
  toNonNegativeMoneyDecimal,
  toNumber,
};
