async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "请求失败，请稍后重试。");
  }

  return payload;
}

export const api = {
  dashboard: () => request("/api/dashboard"),
  prompts: (params = {}) =>
    request(`/api/prompts?${new URLSearchParams(params).toString()}`),
  randomPrompt: (type) =>
    request(`/api/prompts/random${type ? `?type=${encodeURIComponent(type)}` : ""}`),
  toggleFavorite: (id, isFavorite) =>
    request(`/api/prompts/${id}/favorite`, {
      method: "PATCH",
      body: JSON.stringify({ isFavorite }),
    }),
  works: (params = {}) =>
    request(`/api/works?${new URLSearchParams(params).toString()}`),
  work: (id) => request(`/api/works/${id}`),
  createWork: (body) =>
    request("/api/works", { method: "POST", body: JSON.stringify(body) }),
  saveWork: (id, body) =>
    request(`/api/works/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  completeWork: (id, body) =>
    request(`/api/works/${id}/complete`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteWork: (id) => request(`/api/works/${id}`, { method: "DELETE" }),
  stats: (days = 30) => request(`/api/stats?days=${days}`),
  characters: (params = {}) =>
    request(`/api/characters?${new URLSearchParams(params).toString()}`),
  character: (id) => request(`/api/characters/${id}`),
  createCharacter: (body) =>
    request("/api/characters", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  saveCharacter: (id, body) =>
    request(`/api/characters/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  deleteCharacter: (id) =>
    request(`/api/characters/${id}`, { method: "DELETE" }),
  characterTags: () => request("/api/character-tags"),
  characterFields: (includeDeleted = false) =>
    request(`/api/character-fields?includeDeleted=${includeDeleted}`),
  createCharacterField: (body) =>
    request("/api/character-fields", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  saveCharacterField: (id, body) =>
    request(`/api/character-fields/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  reorderCharacterFields: (items) =>
    request("/api/character-fields/reorder", {
      method: "PUT",
      body: JSON.stringify({ items }),
    }),
  deleteCharacterField: (id) =>
    request(`/api/character-fields/${id}`, { method: "DELETE" }),
};
