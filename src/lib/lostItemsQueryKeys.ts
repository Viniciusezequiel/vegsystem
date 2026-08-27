export type LostItemsQueryFilters = {
  status?: string;
  search?: string;
  campus?: string;
  dateFrom?: string;
  dateTo?: string;
  destination?: string;
};

export const lostItemsQueryKeys = {
  lists: ['lost-items'] as const,
  infiniteLists: ['lost-items-infinite'] as const,
  infinite: (filters?: LostItemsQueryFilters) => [
    'lost-items-infinite',
    filters?.status,
    filters?.search,
    filters?.campus,
    filters?.dateFrom,
    filters?.dateTo,
    filters?.destination,
  ] as const,
  detail: ['lost-item'] as const,
  image: (id: string | null) => ['lost-item-image', id] as const,
  images: ['lost-item-image'] as const,
  counts: ['lost-items-counts'] as const,
  archive: ['lost-items-archive'] as const,
  archiveList: (campus?: string) => ['lost-items-archive', campus] as const,
  archiveDetail: (id?: string) => ['lost-items-archive-detail', id] as const,
  archiveCount: ['lost-items-archive-count'] as const,
};
