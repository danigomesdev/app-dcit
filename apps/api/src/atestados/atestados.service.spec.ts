import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { AtestadosService } from './atestados.service';
import { ANTHROPIC_CLIENT } from './anthropic-client.token';

describe('AtestadosService', () => {
  let service: AtestadosService;
  const parseMock = jest.fn();
  const anthropicMock = { messages: { parse: parseMock } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtestadosService,
        { provide: ANTHROPIC_CLIENT, useValue: anthropicMock },
      ],
    }).compile();

    service = module.get(AtestadosService);
  });

  it('sends the image to Claude and returns the parsed extraction', async () => {
    parseMock.mockResolvedValue({
      parsed_output: {
        cid: 'J06.9',
        crm: 'CRM-MG 45213',
        medico: 'Dr. Carlos Mendes',
        dias: 2,
      },
    });

    const result = await service.extract({
      imageBase64: 'aGVsbG8=',
      mediaType: 'image/jpeg',
    });

    expect(result).toEqual({
      cid: 'J06.9',
      crm: 'CRM-MG 45213',
      medico: 'Dr. Carlos Mendes',
      dias: 2,
    });

    expect(parseMock).toHaveBeenCalledTimes(1);
    const calls = parseMock.mock.calls as unknown[][];
    const callArgs = calls[0][0] as {
      model: string;
      messages: Array<{
        role: string;
        content: Array<{
          type: string;
          source?: { type: string; media_type: string; data: string };
        }>;
      }>;
    };
    expect(callArgs.model).toBe('claude-haiku-4-5');
    expect(callArgs.messages).toHaveLength(1);
    expect(callArgs.messages[0].role).toBe('user');
    const imageBlock = callArgs.messages[0].content.find(
      (block) => block.type === 'image',
    );
    expect(imageBlock?.source).toEqual({
      type: 'base64',
      media_type: 'image/jpeg',
      data: 'aGVsbG8=',
    });
  });

  it('throws when Claude cannot return a structured result', async () => {
    parseMock.mockResolvedValue({ parsed_output: null });

    await expect(
      service.extract({ imageBase64: 'aGVsbG8=', mediaType: 'image/jpeg' }),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('throws a generic error when the Claude API call fails', async () => {
    parseMock.mockRejectedValue(new Error('network error'));

    await expect(
      service.extract({ imageBase64: 'aGVsbG8=', mediaType: 'image/jpeg' }),
    ).rejects.toThrow(InternalServerErrorException);
  });
});
