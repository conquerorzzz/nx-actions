import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  actionSpecOpenApiPostRequestBody,
  actionsSpecOpenApiGetResponse,
  actionsSpecOpenApiPostResponse,
} from '../openapi';
import {
  ActionsSpecErrorResponse,
  ActionsSpecGetResponse,
  ActionsSpecPostRequestBody,
  ActionsSpecPostResponse,
} from '../../spec/actions-spec';
import nxlendApi from './nxlend-api';

export const NX_ACTION_IMG = 'https://img.picgo.net/2024/07/01/nxaction6e1546b1b6a2a647.png';

const SWAP_AMOUNT_USD_OPTIONS = [0.1, 1, 10];
const DEFAULT_SWAP_AMOUNT_USD = 1;
const US_DOLLAR_FORMATTING = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const app = new OpenAPIHono();

app.openapi(
  createRoute({
    method: 'get',
    path: '/{reserve}',
    tags: ['NxFi Lending'],
    request: {
      params: z.object({
        reserve: z.string().openapi({
          param: {
            name: 'reserve',
            in: 'path',
          },
          type: 'string',
          example: 'usdc',
        }),
      }),
    },
    responses: actionsSpecOpenApiGetResponse,
  }),
  async (c) => {
    const reserve = c.req.param('reserve');

    const inputToken = reserve;
    const inputTokenMeta = await nxlendApi.lookupToken(inputToken)
    console.log('inputToken',inputToken)
    console.log('inputTokenMeta',inputTokenMeta)
    if (!inputTokenMeta) {
      return Response.json({
        icon: NX_ACTION_IMG,
        label: 'Not Available',
        title: `Supply ${inputToken}`,
        description: `Supply ${inputToken}`,
        disabled: true,
        error: {
          message: `Token metadata not found.`,
        },
      } satisfies ActionsSpecGetResponse);
    }

    const amountParameterName = 'amount';
    const response: ActionsSpecGetResponse = {
      icon: NX_ACTION_IMG,
      label: `Supply ${inputTokenMeta.tokenSymbol}`,
      title: `Supply ${inputTokenMeta.tokenSymbol}`,
      description: `Supply ${inputTokenMeta.tokenSymbol}. Choose amount of ${inputTokenMeta.tokenSymbol} from the options below, or enter a custom amount.(If you are using nxfi's service for the first time, there will be a fee of approximately 0.02339 SOL for creating the nxfi account.)`,
      links: {
        actions: [
          ...SWAP_AMOUNT_USD_OPTIONS.map((amount) => ({
            label: `${amount}`,
            href: `/api/nxlending/supply/${reserve}/${amount}`,
          })),
          {
            href: `/api/nxlending/supply/${reserve}/{${amountParameterName}}`,
            label: `Supply ${inputTokenMeta.tokenSymbol}`,
            parameters: [
              {
                name: amountParameterName,
                label: 'Enter a custom amount',
              },
            ],
          },
        ],
      },
    };

    return c.json(response);
  },
);

app.openapi(
  createRoute({
    method: 'get',
    path: '/{reserve}/{amount}',
    tags: ['NxFi Lending'],
    request: {
      params: z.object({
        reserve: z.string().openapi({
          param: {
            name: 'reserve',
            in: 'path',
          },
          type: 'string',
          example: 'usdc',
        }),
        amount: z
        .string()
        .optional()
        .openapi({
          param: {
            name: 'amount',
            in: 'path',
            required: false,
          },
          type: 'number',
          example: '1',
        }),
      }),
    },
    responses: actionsSpecOpenApiGetResponse,
  }),
  async (c) => {
    const reserve = c.req.param('reserve');
    const amount = c.req.param('amount');

    const inputToken = reserve;
    const inputTokenMeta = await nxlendApi.lookupToken(inputToken)
    console.log('inputToken',inputToken)
    console.log('inputTokenMeta',inputTokenMeta)
    if (!inputTokenMeta) {
      return Response.json({
        icon: NX_ACTION_IMG,
        label: 'Not Available',
        title: `Supply ${inputToken}`,
        description: `Supply ${inputToken}`,
        disabled: true,
        error: {
          message: `Token metadata not found.`,
        },
      } satisfies ActionsSpecGetResponse);
    }
    const response: ActionsSpecGetResponse = {
      icon: NX_ACTION_IMG,
      label: `Supply ${amount} ${inputTokenMeta.tokenSymbol}`,
      title: `Supply ${amount} ${inputTokenMeta.tokenSymbol}`,
      description: `Supply ${inputToken}(If you are using nxfi's service for the first time, there will be a fee of approximately 0.02339 SOL for creating the nxfi account.)`,
    };

    return c.json(response);
  },
);


app.openapi(
  createRoute({
    method: 'post',
    path: '/{reserve}',
    tags: ['NxFi Lending'],
    request: {
      params: z.object({
        reserve: z.string().openapi({
          param: {
            name: 'reserve',
            in: 'path',
          },
          type: 'string',
          example: 'SOL',
        }),
      }),
      body: actionSpecOpenApiPostRequestBody,
    },
    responses: actionsSpecOpenApiPostResponse,
  }),
  async (c) => {
    const reserve = c.req.param('reserve');
    const amount = c.req.param('amount') ?? DEFAULT_SWAP_AMOUNT_USD.toString();
    const { account } = (await c.req.json()) as ActionsSpecPostRequestBody;

    const inputToken = reserve
    const inputTokenMeta = await nxlendApi.lookupToken(inputToken)

    if (!inputTokenMeta) {
      return Response.json(
        {
          message: `Token metadata not found.`,
        } satisfies ActionsSpecErrorResponse,
        {
          status: 422,
        },
      );
    }
    const tx = await nxlendApi.deposit(inputTokenMeta,amount,account)
    console.log('tx',tx)
    const response: ActionsSpecPostResponse = {
      transaction: tx,
    };
    return c.json(response);
  },
);


app.openapi(
  createRoute({
    method: 'post',
    path: '/{reserve}/{amount}',
    tags: ['NxFi Lending'],
    request: {
      params: z.object({
        reserve: z.string().openapi({
          param: {
            name: 'reserve',
            in: 'path',
          },
          type: 'string',
          example: 'SOL',
        }),
        amount: z
          .string()
          .optional()
          .openapi({
            param: {
              name: 'amount',
              in: 'path',
              required: false,
            },
            type: 'number',
            example: '1',
          }),
      }),
      body: actionSpecOpenApiPostRequestBody,
    },
    responses: actionsSpecOpenApiPostResponse,
  }),
  async (c) => {
    const reserve = c.req.param('reserve');
    const amount = c.req.param('amount') ?? DEFAULT_SWAP_AMOUNT_USD.toString();
    const { account } = (await c.req.json()) as ActionsSpecPostRequestBody;

    const inputToken = reserve
    const inputTokenMeta = await nxlendApi.lookupToken(inputToken)

    if (!inputTokenMeta) {
      return Response.json(
        {
          message: `Token metadata not found.`,
        } satisfies ActionsSpecErrorResponse,
        {
          status: 422,
        },
      );
    }
    const tx = await nxlendApi.deposit(inputTokenMeta,amount,account)
    console.log('tx',tx)
    const response: ActionsSpecPostResponse = {
      transaction: tx,
    };
    return c.json(response);
  },
);

export default app;
