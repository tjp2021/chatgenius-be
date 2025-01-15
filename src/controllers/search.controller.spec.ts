import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from '../lib/search.service';
import { SearchRequestDto } from './dto/search.dto';

describe('SearchController', () => {
  let controller: SearchController;
  let searchService: SearchService;

  const mockSearchService = {
    search: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        {
          provide: SearchService,
          useValue: mockSearchService,
        },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    searchService = module.get<SearchService>(SearchService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('search', () => {
    const mockRequest: SearchRequestDto = {
      query: 'test query',
    };

    const mockSearchResults = [
      {
        messageId: '1',
        content: 'Test content 1',
        score: 0.9,
      },
      {
        messageId: '2',
        content: 'Test content 2',
        score: 0.8,
      },
    ];

    it('should return search results successfully', async () => {
      mockSearchService.search.mockResolvedValueOnce(mockSearchResults);

      const result = await controller.search(mockRequest);

      expect(result).toEqual({ results: mockSearchResults });
      expect(searchService.search).toHaveBeenCalledWith(mockRequest.query);
      expect(searchService.search).toHaveBeenCalledTimes(1);
    });

    it('should handle empty results', async () => {
      mockSearchService.search.mockResolvedValueOnce([]);

      const result = await controller.search(mockRequest);

      expect(result).toEqual({ results: [] });
      expect(searchService.search).toHaveBeenCalledWith(mockRequest.query);
    });

    it('should throw HttpException when search service fails', async () => {
      const errorMessage = 'Search failed';
      mockSearchService.search.mockRejectedValueOnce(new Error(errorMessage));

      await expect(controller.search(mockRequest)).rejects.toThrow(HttpException);
      expect(searchService.search).toHaveBeenCalledWith(mockRequest.query);
    });
  });
}); 