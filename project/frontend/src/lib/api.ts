/**
 * API client for Bamboo backend.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config: RequestInit = {
    method,
    headers,
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${endpoint}`, config);

  let data;
  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    let errorMessage = '요청 처리 중 오류가 발생했습니다';
    if (data?.detail) {
      if (typeof data.detail === 'string') {
        errorMessage = data.detail;
      } else if (Array.isArray(data.detail)) {
        // Pydantic validation error
        errorMessage = data.detail
          .map((err: any) => err.msg || JSON.stringify(err))
          .join(', ');
      } else {
        errorMessage = JSON.stringify(data.detail);
      }
    }

    throw new ApiError(
      errorMessage,
      response.status,
      data
    );
  }

  return data as T;
}

// Auth
export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  personal_email: string;
  school_email: string | null;
  school_email_verified: boolean;
  school_id: number | null;
  school_name: string | null;
  role: string;
  is_active: boolean;
  nickname: string | null;
}

export const auth = {
  register: (email: string, password: string, nickname: string) =>
    request<{ message: string }>('/auth/register', {
      method: 'POST',
      body: { personal_email: email, password, nickname },
    }),

  registerVerify: (email: string, otp: string) =>
    request<TokenResponse>('/auth/register/verify', {
      method: 'POST',
      body: { personal_email: email, otp },
    }),

  login: (email: string, password: string) =>
    request<TokenResponse>('/auth/login', {
      method: 'POST',
      body: { personal_email: email, password },
    }),

  me: (token: string) =>
    request<UserResponse>('/auth/me', { token }),

  updateMe: (data: { nickname?: string }, token: string) =>
    request<UserResponse>('/auth/me', {
      method: 'PATCH',
      body: data,
      token,
    }),

  requestOTP: (schoolEmail: string, token: string) =>
    request<{ message: string }>('/auth/school-email/request-otp', {
      method: 'POST',
      body: { school_email: schoolEmail },
      token,
    }),

  verifyOTP: (schoolEmail: string, otp: string, token: string) =>
    request<{ message: string }>('/auth/school-email/verify-otp', {
      method: 'POST',
      body: { school_email: schoolEmail, otp },
      token,
    }),

  requestDomain: (data: {
    school_name: string;
    school_short_name: string;
    email_domain: string;
    description?: string;
  }, token: string) =>
    request<DomainRequestResponse>('/auth/domain-request', {
      method: 'POST',
      body: data,
      token,
    }),

  getMyDomainRequests: (token: string) =>
    request<DomainRequestResponse[]>('/auth/domain-request/my', { token }),

  deleteAccount: (token: string) =>
    request<{ message: string }>('/auth/me', {
      method: 'DELETE',
      token,
    }),

  changePassword: (data: { current_password: string; new_password: string }, token: string) =>
    request<{ message: string }>('/auth/me/password', {
      method: 'PATCH',
      body: data,
      token,
    }),

  requestPasswordReset: (email: string) =>
    request<{ message: string }>('/auth/password-reset/request', {
      method: 'POST',
      body: { personal_email: email },
    }),

  confirmPasswordReset: (email: string, otp: string, newPassword: string) =>
    request<{ message: string }>('/auth/password-reset/confirm', {
      method: 'POST',
      body: { personal_email: email, otp, new_password: newPassword },
    }),
};

// Domain Request
export interface DomainRequestResponse {
  id: number;
  requester_id: number;
  requester_email: string | null;
  school_name: string;
  school_short_name: string;
  email_domain: string;
  description: string | null;
  status: string;
  admin_note: string | null;
  resolved_by_id: number | null;
  created_at: string;
}

export interface DomainRequestListResponse {
  requests: DomainRequestResponse[];
  total: number;
  page: number;
  page_size: number;
}

// Admin
export interface SchoolAdminResponse {
  id: number;
  name: string;
  short_name: string;
  allowed_domains: string[];
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ReportResponse {
  id: number;
  reporter_id: number;
  target_type: 'POST' | 'COMMENT';
  target_id: number;
  reason: string;
  description: string | null;
  status: 'PENDING' | 'RESOLVED' | 'REJECTED';
  resolved_by_id: number | null;
  resolution_note: string | null;
  created_at: string;
}

export interface ReportListResponse {
  reports: ReportResponse[];
  total: number;
  page: number;
  page_size: number;
}

export const admin = {
  createSchool: (data: { name: string; short_name: string; allowed_domains: string[]; description?: string; is_active?: boolean }, token: string) =>
    request<SchoolAdminResponse>('/admin/schools', {
      method: 'POST',
      body: data,
      token,
    }),
  getSchools: (token: string, page = 1) =>
    request<{ schools: SchoolAdminResponse[]; total: number; page: number; page_size: number }>(
      '/admin/schools?page=' + page,
      { token }
    ),

  updateSchool: (schoolId: number, data: { short_name?: string; is_active?: boolean; allowed_domains?: string[] }, token: string) =>
    request<SchoolAdminResponse>(`/admin/schools/${schoolId}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  deleteSchool: (schoolId: number, token: string) =>
    request<{ message: string }>(`/admin/schools/${schoolId}`, {
      method: 'DELETE',
      token,
    }),

  getReports: (token: string, page = 1, status?: string) =>
    request<ReportListResponse>(
      `/admin/reports?page=${page}${status ? `&status=${status}` : ''}`,
      { token }
    ),

  resolveReport: (reportId: number, status: string, note: string | null, token: string) =>
    request<{ message: string }>(`/admin/reports/${reportId}`, {
      method: 'PATCH',
      body: { status, resolution_note: note },
      token,
    }),

  getDomainRequests: (token: string, page = 1, status?: string) =>
    request<DomainRequestListResponse>(
      `/admin/domain-requests?page=${page}${status ? `&status=${status}` : ''}`,
      { token }
    ),

  resolveDomainRequest: (requestId: number, status: string, note: string | null, token: string) =>
    request<{ message: string }>(`/admin/domain-requests/${requestId}`, {
      method: 'PATCH',
      body: { status, admin_note: note },
      token,
    }),

  deleteDomainRequest: (requestId: number, token: string) =>
    request<{ message: string }>(`/admin/domain-requests/${requestId}`, {
      method: 'DELETE',
      token,
    }),
};

// ── Con (이모티콘) ──────────────────────────────
export interface ConItemResponse {
  id: number;
  pack_id: number;
  name: string | null;
  sort_order: number;
  image_url: string;
}

export interface ConPackResponse {
  id: number;
  name: string;
  description: string | null;
  status: string;
  uploader_id: number;
  admin_note: string | null;
  item_count: number;
  thumbnail_url: string | null;
  created_at: string;
}

export interface ConPackDetailResponse extends ConPackResponse {
  items: ConItemResponse[];
}

export interface ConPackListResponse {
  packs: ConPackResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface MyConPackResponse {
  id: number;
  name: string;
  thumbnail_url: string | null;
  items: ConItemResponse[];
}

export interface ConItemMeta {
  id: number;
  image_url: string;
}

export const cons = {
  /** 콘 이미지 단일 업로드 (멀티파트) */
  uploadConImage: async (file: File, token: string): Promise<{ file_id: number; image_url: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
    const response = await fetch(`${API_URL}/cons/upload-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(data?.detail || '업로드 오류', response.status, data);
    }
    return response.json();
  },

  /** 밤부콘 신청 (이미 업로드된 file_ids 사용) */
  createConPack: (name: string, description: string | null, fileIds: number[], token: string) => {
    const params = new URLSearchParams({
      name,
      file_ids: fileIds.join(','),
      ...(description ? { description } : {}),
    });
    return request<{ id: number; name: string; status: string }>(`/cons/packs?${params.toString()}`, {
      method: 'POST',
      token,
    });
  },

  /** 밤부콘 스토어 목록 */
  listConPacks: (token: string, page = 1, search?: string) =>
    request<ConPackListResponse>(
      `/cons/packs?page=${page}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      { token }
    ),

  /** 밤부콘 상세 */
  getConPack: (packId: number, token: string) =>
    request<ConPackDetailResponse>(`/cons/packs/${packId}`, { token }),

  /** 밤부콘 삭제 */
  deletePack: (packId: number, token: string) =>
    request<{ message: string }>(`/cons/packs/${packId}`, { method: 'DELETE', token }),

  /** 내 보관함 (에디터 피커용) */
  getMyConPacks: (token: string) =>
    request<MyConPackResponse[]>('/cons/my', { token }),

  /** 내 신청 목록 */
  getMyConRequests: (token: string, page = 1) =>
    request<ConPackListResponse>(`/cons/my-requests?page=${page}`, { token }),

  /** 보관함에 추가 */
  addToInventory: (packId: number, token: string) =>
    request<{ message: string }>(`/cons/packs/${packId}/add`, { method: 'POST', token }),

  /** 보관함에서 제거 */
  removeFromInventory: (packId: number, token: string) =>
    request<{ message: string }>(`/cons/packs/${packId}/remove`, { method: 'DELETE', token }),

  /** 콘 메타 배치 조회 */
  getConItemsMeta: (ids: number[], token: string) =>
    request<ConItemMeta[]>(`/cons/items/meta?ids=${ids.join(',')}`, { token }),

  /** 관리자: 신청 목록 */
  adminListConRequests: (token: string, statusFilter?: string, page = 1) =>
    request<ConPackListResponse>(
      `/admin/cons/requests?page=${page}${statusFilter ? `&status_filter=${statusFilter}` : ''}`,
      { token }
    ),

  /** 관리자: 신청 처리 */
  adminResolveConRequest: (packId: number, status: string, adminNote: string | null, token: string) =>
    request<{ message: string }>(`/admin/cons/requests/${packId}`, {
      method: 'PATCH',
      body: { status, admin_note: adminNote },
      token,
    }),
};

// Board Management
export interface BoardRequestResponse {
  id: number;
  requester_id: number;
  requester_email: string | null;
  requester_school_name: string | null;
  board_name: string;
  board_description: string | null;
  school_ids: number[];
  school_names: string[];
  status: string;
  admin_note: string | null;
  created_at: string;
}

export interface SchoolListItem {
  id: number;
  name: string;
  short_name: string;
}

export interface BoardManageInfo {
  id: number;
  name: string;
  description: string | null;
  board_type: string;
  is_active: boolean;
  hot_post_threshold: number;
  accessible_schools: SchoolListItem[];
  managers: { user_id: number; email: string; role: string; school_id: number | null }[];
  owner_school_id: number | null;
  my_role: string | null;
  created_at: string;
}

export interface SubManagerCandidate {
  user_id: number;
  email: string;
  nickname: string | null;
  school_id: number | null;
}

export interface ReportItem {
  id: number;
  reporter_id: number;
  target_type: string;
  target_id: number;
  board_id: number | null;
  post_id: number | null;
  reason: string;
  description: string | null;
  status: string;
  resolved_by_id: number | null;
  resolution_note: string | null;
  created_at: string | null;
}

export interface BoardReportListResponse {
  reports: ReportItem[];
  total: number;
  page: number;
  page_size: number;
}

export const boardManage = {
  createRequest: (data: { board_name: string; board_description?: string; school_ids: number[] }, token: string) =>
    request<BoardRequestResponse>('/board-requests', {
      method: 'POST',
      body: data,
      token,
    }),

  getMyRequests: (token: string) =>
    request<BoardRequestResponse[]>('/board-requests/my', { token }),

  getSchoolsList: (token: string) =>
    request<SchoolListItem[]>('/manage/schools', { token }),

  getRequestsAdmin: (token: string, statusFilter?: string) =>
    request<BoardRequestResponse[]>(
      `/admin/board-requests${statusFilter ? `?status_filter=${statusFilter}` : ''}`,
      { token }
    ),

  resolveRequest: (requestId: number, action: string, adminNote: string | null, token: string) =>
    request<{ message: string }>(`/admin/board-requests/${requestId}/resolve`, {
      method: 'POST',
      body: { action, admin_note: adminNote },
      token,
    }),

  getManagedBoards: (token: string) =>
    request<BoardManageInfo[]>('/manage/boards', { token }),

  getBoardManageInfo: (boardId: number, token: string) =>
    request<BoardManageInfo>(`/manage/boards/${boardId}`, { token }),

  updateBoard: (boardId: number, data: { description?: string; hot_post_threshold?: number }, token: string) =>
    request<{ message: string }>(`/manage/boards/${boardId}`, {
      method: 'PATCH',
      body: data,
      token,
    }),

  addSchool: (boardId: number, schoolId: number, token: string) =>
    request<{ message: string }>(`/manage/boards/${boardId}/schools`, {
      method: 'POST',
      body: { school_id: schoolId },
      token,
    }),

  removeSchool: (boardId: number, schoolId: number, token: string) =>
    request<{ message: string }>(`/manage/boards/${boardId}/schools/${schoolId}`, {
      method: 'DELETE',
      token,
    }),

  deletePost: (boardId: number, postId: number, token: string) =>
    request<{ message: string }>(`/manage/boards/${boardId}/posts/${postId}`, {
      method: 'DELETE',
      token,
    }),

  getSubManagerCandidates: (boardId: number, token: string, q?: string) =>
    request<SubManagerCandidate[]>(
      `/manage/boards/${boardId}/sub-manager-candidates${q ? `?q=${encodeURIComponent(q)}` : ''}`,
      { token }
    ),

  addSubManager: (boardId: number, userId: number, token: string) =>
    request<{ message: string }>(`/manage/boards/${boardId}/sub-managers`, {
      method: 'POST',
      body: { user_id: userId },
      token,
    }),

  removeSubManager: (boardId: number, userId: number, token: string) =>
    request<{ message: string }>(`/manage/boards/${boardId}/sub-managers/${userId}`, {
      method: 'DELETE',
      token,
    }),

  getBoardReports: (boardId: number, token: string, page = 1, status?: string) =>
    request<BoardReportListResponse>(
      `/manage/boards/${boardId}/reports?page=${page}${status ? `&status_filter=${status}` : ''}`,
      { token }
    ),

  resolveBoardReport: (boardId: number, reportId: number, status: string, note: string | null, token: string) =>
    request<{ message: string }>(`/manage/boards/${boardId}/reports/${reportId}`, {
      method: 'PATCH',
      body: { status, resolution_note: note },
      token,
    }),

  requestBoardDeletion: (boardId: number, token: string) =>
    request<{ message: string }>(`/manage/boards/${boardId}/delete-request`, {
      method: 'POST',
      token,
    }),

  transferOwnership: (boardId: number, userId: number, token: string) =>
    request<{ message: string }>(`/manage/boards/${boardId}/transfer-ownership`, {
      method: 'POST',
      body: { user_id: userId },
      token,
    }),
};

// Boards
export interface HeadingResponse {
  id: number;
  name: string;
  color: string;
  sort_order: number;
}

export interface BoardResponse {
  id: number;
  name: string;
  description: string | null;
  board_type: string;
  school_id: number | null;
  school_name: string | null;
  hot_post_threshold: number;
  is_manager: boolean;
  headings: HeadingResponse[];
}

export const boards = {
  list: (token: string) =>
    request<{ boards: BoardResponse[] }>('/boards', { token }),

  get: (id: number, token: string) =>
    request<BoardResponse>(`/boards/${id}`, { token }),
};

// Posts
export interface AuthorInfo {
  anon_number: number | null;
  school_name: string | null;
  is_author: boolean;
  is_post_author?: boolean;
  nickname: string | null;
}

export interface FileInfo {
  id: number;
  original_name: string;
  mime_type: string;
  size: number;
  storage_key: string;
  thumb_key: string | null;
  width: number | null;
  height: number | null;
}

export interface PostListItem {
  id: number;
  board_id: number | null;
  board_name: string | null;
  heading_id: number | null;
  heading_name: string | null;
  heading_color: string | null;
  title: string;
  author: AuthorInfo;
  is_pinned: boolean;
  is_notice: boolean;
  view_count: number;
  comment_count: number;
  like_count: number;
  dislike_count: number;
  has_attachment: boolean;
  created_at: string;
}

export interface PostResponse {
  id: number;
  board_id: number;
  heading_id: number | null;
  heading_name: string | null;
  heading_color: string | null;
  title: string;
  body: string;
  author: AuthorInfo;
  is_pinned: boolean;
  is_notice: boolean;
  is_hidden: boolean;
  view_count: number;
  comment_count: number;
  like_count: number;
  dislike_count: number;
  my_vote: 'LIKE' | 'DISLIKE' | null;
  my_scrap: boolean;
  is_manager: boolean;
  files: FileInfo[];
  created_at: string;
  updated_at: string;
}

export interface VoteResponse {
  like_count: number;
  dislike_count: number;
  my_vote: 'LIKE' | 'DISLIKE' | null;
}

export interface PostListResponse {
  posts: PostListItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const posts = {
  list: (boardId: number, token: string, params?: { heading_id?: number; hot?: boolean; notice?: boolean; page?: number; q?: string }) => {
    const urlParams = new URLSearchParams();
    if (params?.heading_id) urlParams.set('heading_id', params.heading_id.toString());
    if (params?.hot) urlParams.set('hot', 'true');
    if (params?.notice) urlParams.set('notice', 'true');
    if (params?.page) urlParams.set('page', params.page.toString());
    if (params?.q) urlParams.set('q', params.q);

    return request<PostListResponse>(
      `/boards/${boardId}/posts?${urlParams.toString()}`,
      { token }
    );
  },

  get: (id: number, token: string) =>
    request<PostResponse>(`/posts/${id}`, { token }),

  create: (boardId: number, data: { heading_id?: number; title: string; body: string; attached_file_ids?: number[]; use_nickname?: boolean; is_notice?: boolean }, token: string) =>
    request<PostResponse>(`/boards/${boardId}/posts`, {
      method: 'POST',
      body: data,
      token,
    }),

  delete: (postId: number, token: string) =>
    request<{ message: string }>(`/posts/${postId}`, {
      method: 'DELETE',
      token,
    }),

  vote: (postId: number, voteType: 'LIKE' | 'DISLIKE', token: string) =>
    request<VoteResponse>(`/posts/${postId}/vote`, {
      method: 'POST',
      body: { vote_type: voteType },
      token,
    }),

  my: (token: string, page = 1) =>
    request<PostListResponse>(`/posts/my?page=${page}`, { token }),

  scrap: (postId: number, token: string) =>
    request<{ message: string }>(`/posts/${postId}/scrap`, {
      method: 'POST',
      token,
    }),

  scrapped: (token: string, page = 1) =>
    request<PostListResponse>(`/posts/scrapped?page=${page}`, { token }),

  hot: (token: string, limit = 10) =>
    request<PostListResponse>(`/posts/hot?limit=${limit}`, { token }),
};

// Comments
export interface CommentResponse {
  id: number;
  post_id: number;
  parent_id: number | null;
  body: string;
  author: AuthorInfo;
  is_hidden: boolean;
  is_deleted: boolean;
  like_count: number;
  dislike_count: number;
  my_vote: 'LIKE' | 'DISLIKE' | null;
  can_delete: boolean;
  created_at: string;
  replies: CommentResponse[];
}

export interface MyCommentItem {
  id: number;
  post_id: number;
  post_title: string | null;
  board_id: number | null;
  board_name: string | null;
  body: string;
  like_count: number;
  dislike_count: number;
  created_at: string;
}

export interface MyCommentListResponse {
  comments: MyCommentItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const comments = {
  list: (postId: number, token: string) =>
    request<{ comments: CommentResponse[]; total: number }>(`/posts/${postId}/comments`, { token }),

  create: (postId: number, body: string, parentId: number | null, token: string, useNickname?: boolean) =>
    request<CommentResponse>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: { body, parent_id: parentId, use_nickname: useNickname },
      token,
    }),

  delete: (commentId: number, token: string) =>
    request<{ message: string }>(`/comments/${commentId}`, {
      method: 'DELETE',
      token,
    }),

  vote: (commentId: number, voteType: 'LIKE' | 'DISLIKE', token: string) =>
    request<VoteResponse>(`/comments/${commentId}/vote`, {
      method: 'POST',
      body: { vote_type: voteType },
      token,
    }),

  my: (token: string, page = 1) =>
    request<MyCommentListResponse>(`/comments/my?page=${page}`, { token }),
};

// Reports
export const reports = {
  create: (targetType: string, targetId: number, reason: string | null, description: string | null, token: string) =>
    request<{ message: string }>('/reports', {
      method: 'POST',
      body: { target_type: targetType, target_id: targetId, reason, description },
      token,
    }),
};

// Uploads
export interface UploadResponse {
  id: number;
  original_name: string;
  mime_type: string;
  size: number;
  storage_key: string;
  thumb_key: string | null;
  width: number | null;
  height: number | null;
  created_at: string;
}

export const uploads = {
  upload: async (file: globalThis.File, token: string): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_URL}/uploads`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new ApiError(
        data?.detail || '업로드 중 오류가 발생했습니다',
        response.status,
        data
      );
    }

    return response.json();
  },
};

export { ApiError };
