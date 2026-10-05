import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const getRequestContext = (): RequestContext | undefined => requestContext.getStore();
