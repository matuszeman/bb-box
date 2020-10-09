import {Bbox, BboxModule, Cli, Ctx, Runtime, Module} from '../../bbox';

export class ProxyModule implements BboxModule {
  private bbox: Bbox;

  constructor() {

  }

  async onInit(bbox: Bbox, ctx: Ctx) {
    this.bbox = bbox;
  }

  async onCliInit(bbox: Bbox, cli: Cli, ctx: Ctx) {
    cli.command(`proxy:configure`).action(async () => {

    });
  }

  async beforeStart(bbox: Bbox, ctx: Ctx) {

  }

  async beforeStatus(bbox: Bbox, ctx: Ctx) {

  }
}

const proxyModule = new ProxyModule();
export default proxyModule;
