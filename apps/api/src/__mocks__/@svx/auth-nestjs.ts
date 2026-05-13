import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';
export const Permissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);
export const Public = () => SetMetadata('isPublic', true);

export class JwtAuthGuard {}
export class PermissionsGuard {}
export const AuthNestjsModule = { forRootAsync: () => ({ module: class AuthNestjsMock {} }) };
export const discoverJwksUri = async () => '';
export interface AuthNestjsSettings {}
