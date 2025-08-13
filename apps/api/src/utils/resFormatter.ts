// 1) Message templates
const templates = {
  S3_INITIATION_FAILED: '${details}',
  S3_COMPLETE_FAILED: '${details}',
  S3_HEAD_FAILED: '${details}',
  S3_COPY_FAILED: '${details}',
  OUT_OF_RANGE: '{field} out of allowed range. Expected {min}–{max}, got {actual}',
  IS_TRASHED: '{field} is trashed',
  INVALID_TYPE: '{field} must be a {expected}, got {actualType}',
  INVALID_STATE: '{field} must be in these states: [{expected}]. Got {actualType} instead',
  INVALID_VALUE: 'Invalid ${valueName} of ${field}',
  UNEXPECTED_TYPE: '{field} must be a {expected}, got {actualType}', // in case of server malfunction
  INVALID_CONTINUATION: '${field} must be contiguous starting at ${startNum}',
  ERR_FORBIDDEN_WRITE: 'You have no write permission in this space',
  POLICY_MISMATCH: 'Policy Violation: {fieldA} mismatched with {fieldB}',
  POLICY_DUPLICATE: 'Policy Violation: Duplication of {field} in request',
  POLICY_CHECKSUM_NA: 'Required checksum from client',
  NOT_FOUND: 'Did not find {obj} with {queryKey} of {queryValue}'
} as const;

type Params = {
  S3_INITIATION_FAILED: {details: string};
  S3_COMPLETE_FAILED: {details: string};
  S3_HEAD_FAILED: {details: string},
  S3_COPY_FAILED: {details: string};
  OUT_OF_RANGE: { field: string; min: number ; max: number ; actual: string | number | bigint };
  IS_TRASHED: { field: string };
  INVALID_TYPE: { field: string; expected: string; actualType: string };
  INVALID_STATE: { field: string; expected: string; actualType: string };
  INVALID_VALUE: {field: string, valueName: string};
  INVALID_CONTINUATION: {field: string, startNum: number}
  UNEXPECTED_TYPE: { field: string; expected: string; actualType: string };
  ERR_FORBIDDEN_WRITE: {};
  POLICY_MISMATCH: {fieldA: string, fieldB: string};
  POLICY_DUPLICATE: { field: string };
  POLICY_CHECKSUM_NA: {};
  NOT_FOUND: {obj: string, queryKey: string, queryValue: string }
};

type Code = keyof Params;

export function messageFormatter<K extends Code>(code: K, params: Params[K]): string {
  const tpl = templates[code];
  return tpl.replace(/\{(\w+)\}/g, (_m, key) => String((params as any)[key]));
}

export function errorFormatter<K extends Code>(status: number, code: K, params: Params[K]) {
  return {
    status,
    code,
    message: messageFormatter(code, params),
    details: params,
  };
}