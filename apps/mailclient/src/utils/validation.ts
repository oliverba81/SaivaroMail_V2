export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateEmail = (email: string): ValidationResult => {
  if (!email || email.trim() === '') {
    return { isValid: false, error: 'E-Mail-Adresse ist erforderlich' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Ungültiges E-Mail-Format' };
  }
  return { isValid: true };
};

export const validatePort = (port: string | number): ValidationResult => {
  const portNum = typeof port === 'string' ? parseInt(port) : port;
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return { isValid: false, error: 'Port muss zwischen 1 und 65535 liegen' };
  }
  return { isValid: true };
};

export const validateRequired = (value: string, fieldName: string): ValidationResult => {
  if (!value || value.trim() === '') {
    return { isValid: false, error: `${fieldName} ist erforderlich` };
  }
  return { isValid: true };
};

export const validateHost = (host: string): ValidationResult => {
  if (!host || host.trim() === '') {
    return { isValid: false, error: 'Host ist erforderlich' };
  }
  // Einfache Host-Validierung (Domain oder IP)
  const hostRegex = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^(\d{1,3}\.){3}\d{1,3}$|^localhost$/;
  if (!hostRegex.test(host.trim())) {
    return { isValid: false, error: 'Ungültiges Host-Format' };
  }
  return { isValid: true };
};

export const validatePassword = (password: string, minLength = 8): ValidationResult => {
  if (!password || password.length < minLength) {
    return { isValid: false, error: `Passwort muss mindestens ${minLength} Zeichen lang sein` };
  }
  return { isValid: true };
};



