import { Bbox, BboxModule, Ctx } from '../../bbox';
import { Cli } from '../../cli';
export declare class ProxyModule implements BboxModule {
    private bbox;
    constructor();
    onInit(bbox: Bbox, ctx: Ctx): Promise<void>;
    onCliInit(bbox: Bbox, cli: Cli, ctx: Ctx): Promise<void>;
    beforeStart(bbox: Bbox, ctx: Ctx): Promise<void>;
    beforeStatus(bbox: Bbox, ctx: Ctx): Promise<void>;
}
declare const proxyModule: ProxyModule;
export default proxyModule;
