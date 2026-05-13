export const HTTP_DECORATORS: Record<string, string> = {
  Get: 'GET',
  Post: 'POST',
  Put: 'PUT',
  Patch: 'PATCH',
  Delete: 'DELETE',
};

export const PARAM_DECORATORS = {
  Param: 'path',
  Query: 'query',
  Body: 'body',
  Headers: 'header',
} as const;
