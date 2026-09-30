export type Hmo = {
  hmo_id: number;
  name: string;
  hmo_uuid?: string;
  co_pay: number;
};

export type DrugWithPrice = {
  id: number;
  name: string;
  price: number;
  // Go may also emit capitalized keys before json tags are fixed
  ID?: number;
  Name?: string;
  Price?: number;
};

export type PaginationMeta = {
  current_page: number;
  limit: number;
  total_items: number;
  total_pages: number;
};

export type PaginatedDrugsResponse = {
  data: DrugWithPrice[];
  pagination: PaginationMeta;
};
