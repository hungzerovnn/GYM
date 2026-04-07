import { QueryDto } from '../dto/query.dto';

export const buildPagination = (query: QueryDto) => ({
  skip: (query.page - 1) * query.pageSize,
  take: query.pageSize,
});

export const buildSearchWhere = (
  search: string | undefined,
  fields: string[],
) => {
  if (!search || !fields.length) {
    return undefined;
  }

  return {
    OR: fields.map((field) => ({
      [field]: {
        contains: search,
        mode: 'insensitive',
      },
    })),
  };
};

export const buildSort = (query: QueryDto, fallback: string = 'createdAt') => ({
  [query.sortBy || fallback]: query.sortOrder || 'desc',
});

export const buildDateRange = (field: string, query: QueryDto) => {
  if (!query.dateFrom && !query.dateTo) {
    return undefined;
  }

  return {
    [field]: {
      gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
      lte: query.dateTo ? new Date(query.dateTo) : undefined,
    },
  };
};

export const buildListResponse = <T>(
  data: T[],
  total: number,
  query: QueryDto,
) => ({
  data,
  pagination: {
    total,
    page: query.page,
    pageSize: query.pageSize,
    pageCount: Math.ceil(total / query.pageSize),
  },
});
