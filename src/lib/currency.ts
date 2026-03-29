interface CurrencyConfig {
  symbol: string;
  position: 'before' | 'after';
  decimal: string;
  thousand: string;
}

const currencyConfigs: Record<string, CurrencyConfig> = {
  USD: { symbol: '$', position: 'before', decimal: '.', thousand: ',' },
  EUR: { symbol: '€', position: 'after', decimal: ',', thousand: '.' },
  GBP: { symbol: '£', position: 'before', decimal: '.', thousand: ',' },
  JPY: { symbol: '¥', position: 'before', decimal: '', thousand: ',' },
  CAD: { symbol: 'C$', position: 'before', decimal: '.', thousand: ',' },
  AUD: { symbol: 'A$', position: 'before', decimal: '.', thousand: ',' },
  AED: { symbol: 'AED', position: 'before', decimal: '.', thousand: ',' },
  SAR: { symbol: 'SAR', position: 'before', decimal: '.', thousand: ',' },
  QAR: { symbol: 'QAR', position: 'before', decimal: '.', thousand: ',' },
  KWD: { symbol: 'KWD', position: 'before', decimal: '.', thousand: ',' },
  BHD: { symbol: 'BHD', position: 'before', decimal: '.', thousand: ',' },
  OMR: { symbol: 'OMR', position: 'before', decimal: '.', thousand: ',' },
  INR: { symbol: '₹', position: 'before', decimal: '.', thousand: ',' },
  CHF: { symbol: 'CHF', position: 'before', decimal: '.', thousand: "'" },
  SEK: { symbol: 'kr', position: 'after', decimal: ',', thousand: ' ' },
  NOK: { symbol: 'kr', position: 'after', decimal: ',', thousand: ' ' },
  DKK: { symbol: 'kr', position: 'after', decimal: ',', thousand: '.' },
  TRY: { symbol: '₺', position: 'before', decimal: ',', thousand: '.' },
  ZAR: { symbol: 'R', position: 'before', decimal: '.', thousand: ',' },
  BRL: { symbol: 'R$', position: 'before', decimal: ',', thousand: '.' },
  MXN: { symbol: '$', position: 'before', decimal: '.', thousand: ',' },
  SGD: { symbol: 'S$', position: 'before', decimal: '.', thousand: ',' },
  HKD: { symbol: 'HK$', position: 'before', decimal: '.', thousand: ',' },
  NZD: { symbol: 'NZ$', position: 'before', decimal: '.', thousand: ',' },
  CNY: { symbol: '¥', position: 'before', decimal: '.', thousand: ',' },
  KRW: { symbol: '₩', position: 'before', decimal: '', thousand: ',' },
  PLN: { symbol: 'zł', position: 'after', decimal: ',', thousand: ' ' },
  CZK: { symbol: 'Kč', position: 'after', decimal: ',', thousand: ' ' },
  HUF: { symbol: 'Ft', position: 'after', decimal: ',', thousand: ' ' },
  THB: { symbol: '฿', position: 'before', decimal: '.', thousand: ',' },
  MYR: { symbol: 'RM', position: 'before', decimal: '.', thousand: ',' },
  PHP: { symbol: '₱', position: 'before', decimal: '.', thousand: ',' },
  IDR: { symbol: 'Rp', position: 'before', decimal: ',', thousand: '.' },
  EGP: { symbol: 'E£', position: 'before', decimal: '.', thousand: ',' },
  NGN: { symbol: '₦', position: 'before', decimal: '.', thousand: ',' },
  KES: { symbol: 'KSh', position: 'before', decimal: '.', thousand: ',' },
};

// Global currency set by useBranding — all formatCurrency calls without
// an explicit currency argument will use this value.
let _globalCurrency = 'USD';

/** Called once from useBranding when tenant settings load. */
export function setGlobalCurrency(code: string) {
  _globalCurrency = code || 'USD';
}

export function getGlobalCurrency(): string {
  return _globalCurrency;
}

const zeroPrecisionCurrencies = new Set(['JPY', 'KRW', 'HUF']);

export const formatCurrency = (amount: number, currency?: string): string => {
  const cur = currency || _globalCurrency;
  const config = currencyConfigs[cur] || currencyConfigs.USD;
  
  const decimals = zeroPrecisionCurrencies.has(cur) ? 0 : 2;
  const parts = amount.toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, config.thousand);
  
  const formattedNumber = parts.join(config.decimal);
  
  return config.position === 'before' 
    ? `${config.symbol}${formattedNumber}`
    : `${formattedNumber}${config.symbol}`;
};
