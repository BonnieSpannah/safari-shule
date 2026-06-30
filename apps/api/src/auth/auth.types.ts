export interface JwtAccessClaims {
  sub: string;     // user id
  tid: string;     // tenant id
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

export interface JwtRefreshClaims {
  sub: string;
  tid: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
}
