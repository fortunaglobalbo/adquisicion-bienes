// Formateador monetario y numérico oficial para Bolivia (Bs.)

export function formatCurrencyBs(amount: number): string {
  return new Intl.NumberFormat('es-BO', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount) + ' Bs.';
}

export function formatNumberBO(num: number): string {
  return new Intl.NumberFormat('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

// Conversor de números a palabras en español para montos oficiales
const UNIDADES = ['', 'UN ', 'DOS ', 'TRES ', 'CUATRO ', 'CINCO ', 'SEIS ', 'SIETE ', 'OCHO ', 'NUEVE '];
const DECENAS = [
  'DIEZ ', 'ONCE ', 'DOCE ', 'TRECE ', 'CATORCE ', 'QUINCE ', 'DIECISEIS ', 'DIECISIETE ', 'DIECIOCHO ', 'DIECINUEVE ',
  'VEINTE ', 'VEINTIUN ', 'VEINTIDOS ', 'VEINTITRES ', 'VEINTICUATRO ', 'VEINTICINCO ', 'VEINTISEIS ', 'VEINTISIETE ', 'VEINTIOCHO ', 'VEINTINUEVE '
];
const DECENAS_DIEZ = ['', 'DIEZ ', 'VEINTE ', 'TREINTA ', 'CUARENTA ', 'CINCUENTA ', 'SESENTA ', 'SETENTA ', 'OCHENTA ', 'NOVENTA '];
const CENTENAS = [
  '', 'CIENTO ', 'DOSCIENTOS ', 'TRESCIENTOS ', 'CUATROCIENTOS ', 'QUINIENTOS ', 'SEISCIENTOS ', 'SETECIENTOS ', 'OCHOCIENTOS ', 'NOVECIENTOS '
];

function leerCentenas(num: number): string {
  if (num === 100) return 'CIEN ';
  const c = Math.floor(num / 100);
  const d = Math.floor((num % 100) / 10);
  const u = num % 10;
  let str = CENTENAS[c];

  const du = num % 100;
  if (du < 10) {
    str += UNIDADES[du];
  } else if (du < 30) {
    str += DECENAS[du - 10];
  } else {
    str += DECENAS_DIEZ[d];
    if (u > 0) str += 'Y ' + UNIDADES[u];
  }
  return str;
}

function leerMiles(num: number): string {
  const miles = Math.floor(num / 1000);
  const resto = num % 1000;
  let str = '';
  if (miles === 1) {
    str = 'MIL ';
  } else if (miles > 1) {
    str = leerCentenas(miles) + 'MIL ';
  }
  if (resto > 0) {
    str += leerCentenas(resto);
  }
  return str;
}

export function numeroALiteralBs(monto: number): string {
  const entero = Math.floor(monto);
  const centavos = Math.round((monto - entero) * 100);
  const centavosStr = centavos.toString().padStart(2, '0') + '/100';

  if (entero === 0) {
    return `CERO ${centavosStr} BOLIVIANOS`;
  }

  let literal = '';
  if (entero < 1000) {
    literal = leerCentenas(entero);
  } else if (entero < 1000000) {
    literal = leerMiles(entero);
  } else {
    const millones = Math.floor(entero / 1000000);
    const resto = entero % 1000000;
    if (millones === 1) {
      literal = 'UN MILLÓN ';
    } else {
      literal = leerMiles(millones) + 'MILLONES ';
    }
    if (resto > 0) {
      literal += leerMiles(resto);
    }
  }

  return `${literal.trim()} ${centavosStr} BOLIVIANOS`;
}

export function formatDateBO(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('T')[0].split('-');
  const meses = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const mIndex = parseInt(month, 10) - 1;
  return `${day} de ${meses[mIndex] || month} de ${year}`;
}
