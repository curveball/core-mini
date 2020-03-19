import { expect } from 'chai';
import { default as Application, middlewareCall } from '../src/application';
import MemoryRequest from '../src/memory-request';
import Context from '../src/context';

describe('Application', () => {
  it('should instantiate', () => {
    const application = new Application();
    expect(application).to.be.an.instanceof(Application);
  });

  it('should respond to HTTP requests', async () => {
    const application = new Application();
    application.use((ctx, next) => {
      ctx.response.body = 'hi';
    });
    const response = await application.subRequest('GET', '/');
    const body = await response.body;

    expect(body).to.equal('hi');
    expect(response.headers.get('server')).to.equal(
      'curveball/' + require('../package.json').version
    );
    expect(response.status).to.equal(200);

  });

  it('should work with Buffer responses', async () => {
    const application = new Application();
    application.use((ctx, next) => {
      ctx.response.body = Buffer.from('hi');
    });

    const response = await application.subRequest('GET', '/');
    const body = await response.body;

    expect(body).to.eql(Buffer.from('hi'));
    expect(response.headers.get('server')).to.equal(
      'curveball/' + require('../package.json').version
    );
    expect(response.status).to.equal(200);

  });

  it('should work with multiple calls to middlewares', async () => {
    const application = new Application();
    application.use(async (ctx, next) => {
      ctx.response.body = 'hi';
      await next();
    });
    application.use((ctx, next) => {
      ctx.response.headers.set('X-Foo', 'bar');
    });
    const response = await application.subRequest('GET', '/');
    const body = await response.body;

    expect(body).to.equal('hi');
    expect(response.headers.get('X-Foo')).to.equal('bar');
    expect(response.status).to.equal(200);

  });
  it('should work with multiple middlewares as arguments', async () => {
    const application = new Application();
    application.use(async (ctx, next) => {
      ctx.response.body = 'hi';
      await next();
    }),
      application.use((ctx, next) => {
        ctx.response.headers.set('X-Foo', 'bar');
      });
    const response = await application.subRequest('GET', '/');
    expect(response.headers.get('X-Foo')).to.equal('bar');
    expect(response.status).to.equal(200);

  });

  it('should work with object-middlewares', async () => {
    const application = new Application();

    const myMw = {
      [middlewareCall]: async (ctx: Context, next: Function) => {
        ctx.response.body = 'hi';
      }
    };

    application.use(myMw);

    const response = await application.subRequest('GET', '/');
    const body = await response.body;

    expect(body).to.equal('hi');
    expect(response.status).to.equal(200);

  });

  it('should not call sequential middlewares if next is not called', async () => {
    const application = new Application();
    application.use((ctx, next) => {
      ctx.response.body = 'hi';
    });
    application.use((ctx, next) => {
      ctx.response.headers.set('X-Foo', 'bar');
    });

    const response = await application.subRequest('GET', '/');
    const body = await response.body;

    expect(body).to.equal('hi');
    expect(response.headers.get('X-Foo')).to.equal(null);
    expect(response.status).to.equal(200);

  });

  describe('When an uncaught exception happens', () => {
    it('should trigger an "error" event', async () => {
      const application = new Application();
      application.use((ctx, next) => {
        throw new Error('hi');
      });
      let error;
      application.on('error', err => {
        error = err;
      });
      await application.subRequest('GET', '/');

      expect(error).to.be.an.instanceof(Error);
      // @ts-ignore: TS complains about error possibly being undefined.
      expect(error.message).to.equal('hi');

    });

    it('should return an error message in the response body.', async () => {
      const application = new Application();
      application.use((ctx, next) => {
        throw new Error('hi');
      });

      const response = await application.subRequest('GET', '/');
      const body = await response.body;
      expect(body).to.include(': 500');
    });
  });

  describe('When no middlewares are defined', () => {
    it('should do nothing', async () => {
      const application = new Application();
      await application.subRequest('GET', '/');
    });
  });

  describe('Subrequests', () => {
    it('should work with a Request object', async () => {
      let innerRequest;

      const application = new Application();
      application.use(ctx => {
        innerRequest = ctx.request;
        ctx.response.status = 201;
        ctx.response.headers.set('X-Foo', 'bar');
        ctx.response.body = 'hello world';
      });

      const request = new MemoryRequest(
        'POST',
        '/',
        { foo: 'bar' },
        'request-body'
      );
      const response = await application.subRequest(request);

      expect(response.status).to.equal(201);
      expect(response.headers.get('X-Foo')).to.equal('bar');
      expect(response.body).to.equal('hello world');
      expect(innerRequest).to.equal(request);
    });

    it('should work without a Request object', async () => {
      const application = new Application();
      application.use(ctx => {
        ctx.response.status = 201;
        ctx.response.headers.set('X-Foo', 'bar');
        ctx.response.body = 'hello world';
      });

      const response = await application.subRequest(
        'POST',
        '/',
        { foo: 'bar' },
        'request-body'
      );

      expect(response.status).to.equal(201);
      expect(response.headers.get('X-Foo')).to.equal('bar');
      expect(response.body).to.equal('hello world');
    });
  });

  describe('When middlewares did not set an explicit status', () => {
    it('should return 200 when a body was set', async () => {
      const app = new Application();
      app.use(ctx => {
        ctx.response.body = 'hi';
      });
      const response = await app.subRequest('GET', '/');
      expect(response.status).to.equal(200);
    });
    it('should return 404 when no body was set', async () => {
      const app = new Application();
      const response = await app.subRequest('GET', '/');
      expect(response.status).to.equal(404);
    });
  });
});
