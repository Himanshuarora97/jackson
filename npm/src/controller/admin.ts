import {
  IAdminController,
  Storable,
  SAMLSSORecord,
  OIDCSSORecord,
  SAMLTracerInstance,
  Records,
  Trace,
} from '../typings';
import { transformConnections } from './utils';

export class AdminController implements IAdminController {
  private connectionStore: Storable;
  private samlTracer: SAMLTracerInstance;

  constructor({ connectionStore, samlTracer }) {
    this.connectionStore = connectionStore;
    this.samlTracer = samlTracer;
  }

  public async getAllConnection(pageOffset?: number, pageLimit?: number, pageToken?: string) {
    const { data: connectionList, pageToken: nextPageToken } = (await this.connectionStore.getAll(
      pageOffset,
      pageLimit,
      pageToken
    )) as Records<SAMLSSORecord | OIDCSSORecord>;

    if (!connectionList || !connectionList.length) {
      return [];
    }

    return { data: transformConnections(connectionList), pageToken: nextPageToken };
  }

  public async getAllSAMLTraces(pageOffset: number, pageLimit: number, pageToken?: string) {
    const { data: traces, pageToken: nextPageToken } = (await this.samlTracer.getAllTraces(
      pageOffset,
      pageLimit,
      pageToken
    )) as Records<Trace>;

    if (!traces || !traces.length) {
      return [];
    }

    return { data: traces, pageToken: nextPageToken };
  }

  public async getSAMLTraceById(traceId: string) {
    const trace = await this.samlTracer.getByTraceId(traceId);

    return trace;
  }
}
