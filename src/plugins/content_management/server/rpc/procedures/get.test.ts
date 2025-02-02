/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { omit } from 'lodash';

import { validate } from '../../utils';
import { ContentRegistry } from '../../core/registry';
import { createMockedStorage } from '../../core/mocks';
import { EventBus } from '../../core/event_bus';
import { get } from './get';

const { fn, schemas } = get;

const inputSchema = schemas?.in;
const outputSchema = schemas?.out;

if (!inputSchema) {
  throw new Error(`Input schema missing for [get] procedure.`);
}

if (!outputSchema) {
  throw new Error(`Output schema missing for [get] procedure.`);
}

const FOO_CONTENT_ID = 'foo';

describe('RPC -> get()', () => {
  describe('Input/Output validation', () => {
    const validInput = { contentTypeId: 'foo', id: '123', version: 'v1' };

    test('should validate that a contentTypeId and an id is passed', () => {
      [
        { input: validInput },
        {
          input: omit(validInput, 'contentTypeId'),
          expectedError: '[contentTypeId]: expected value of type [string] but got [undefined]',
        },
        {
          input: { ...validInput, unknown: 'foo' },
          expectedError: '[unknown]: definition for this key is missing',
        },
        {
          input: { ...validInput, id: '' }, // id must have min 1 char
          expectedError: '[id]: value has length [0] but it must have a minimum length of [1].',
        },
        {
          input: omit(validInput, 'version'),
          expectedError: '[version]: expected value of type [string] but got [undefined]',
        },
        {
          input: { ...validInput, version: '1' }, // invalid version format
          expectedError: '[version]: must follow the pattern [v${number}]',
        },
      ].forEach(({ input, expectedError }) => {
        const error = validate(input, inputSchema);

        if (!expectedError) {
          try {
            expect(error).toBe(null);
          } catch (e) {
            throw new Error(`Expected no error but got [{${error?.message}}].`);
          }
        } else {
          expect(error?.message).toBe(expectedError);
        }
      });
    });

    test('should allow an options "object" to be passed', () => {
      let error = validate(
        {
          contentTypeId: 'foo',
          id: '123',
          version: 'v1',
          options: { any: 'object' },
        },
        inputSchema
      );

      expect(error).toBe(null);

      error = validate(
        {
          contentTypeId: 'foo',
          id: '123',
          version: 'v1',
          options: 123, // Not an object
        },
        inputSchema
      );

      expect(error?.message).toBe(
        '[options]: expected a plain object value, but found [number] instead.'
      );
    });

    test('should validate that the response is an object', () => {
      let error = validate(
        {
          any: 'object',
        },
        outputSchema
      );

      expect(error).toBe(null);

      error = validate(123, outputSchema);

      expect(error?.message).toBe('expected a plain object value, but found [number] instead.');
    });
  });

  describe('procedure', () => {
    const setup = () => {
      const contentRegistry = new ContentRegistry(new EventBus());
      const storage = createMockedStorage();
      contentRegistry.register({
        id: FOO_CONTENT_ID,
        storage,
        version: {
          latest: 'v2',
        },
      });

      const requestHandlerContext = 'mockedRequestHandlerContext';
      const ctx: any = { contentRegistry, requestHandlerContext };

      return { ctx, storage };
    };

    test('should return the storage get() result', async () => {
      const { ctx, storage } = setup();

      const expected = 'GetResult';
      storage.get.mockResolvedValueOnce(expected);

      const result = await fn(ctx, { contentTypeId: FOO_CONTENT_ID, id: '1234', version: 'v1' });

      expect(result).toEqual({
        contentTypeId: FOO_CONTENT_ID,
        item: expected,
      });

      expect(storage.get).toHaveBeenCalledWith(
        {
          requestHandlerContext: ctx.requestHandlerContext,
          version: {
            request: 'v1',
            latest: 'v2', // from the registry
          },
        },
        '1234',
        undefined
      );
    });

    describe('validation', () => {
      test('should validate that content type definition exist', () => {
        const { ctx } = setup();
        expect(() => fn(ctx, { contentTypeId: 'unknown', id: '1234' })).rejects.toEqual(
          new Error('Content [unknown] is not registered.')
        );
      });

      test('should throw if the request version is higher than the registered version', () => {
        const { ctx } = setup();
        expect(() =>
          fn(ctx, {
            contentTypeId: FOO_CONTENT_ID,
            id: '1234',
            version: 'v7',
          })
        ).rejects.toEqual(new Error('Invalid version. Latest version is [v2].'));
      });
    });
  });
});
