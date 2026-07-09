import type { AnchorRecommendation } from "@auction/shared";

export type AnchorRecommendationInput = {
  name: string;
  intro: string;
  imageUrl: string;
};

export type AnchorRecommendationsRepository = {
  list(): Promise<AnchorRecommendation[]>;
  create(input: AnchorRecommendationInput): Promise<AnchorRecommendation>;
  update(id: string, input: AnchorRecommendationInput): Promise<AnchorRecommendation | null>;
  delete(id: string): Promise<boolean>;
};

function cloneAnchor(anchor: AnchorRecommendation): AnchorRecommendation {
  return { ...anchor };
}

function sortAnchors(items: AnchorRecommendation[]): AnchorRecommendation[] {
  return [...items].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime() || Number(right.id) - Number(left.id)
  );
}

export function createInMemoryAnchorRecommendationsRepository(
  options: { now?: () => Date } = {}
): AnchorRecommendationsRepository {
  const now = options.now ?? (() => new Date());
  const anchors = new Map<string, AnchorRecommendation>();
  let nextId = 1;

  function save(anchor: AnchorRecommendation): AnchorRecommendation {
    anchors.set(anchor.id, cloneAnchor(anchor));
    return cloneAnchor(anchor);
  }

  return {
    async list() {
      return sortAnchors([...anchors.values()]).map(cloneAnchor);
    },

    async create(input) {
      const timestamp = now().toISOString();
      return save({
        id: String(nextId++),
        name: input.name,
        intro: input.intro,
        imageUrl: input.imageUrl,
        createdAt: timestamp,
        updatedAt: timestamp
      });
    },

    async update(id, input) {
      const existing = anchors.get(id);
      if (!existing) {
        return null;
      }
      return save({
        ...existing,
        name: input.name,
        intro: input.intro,
        imageUrl: input.imageUrl,
        updatedAt: now().toISOString()
      });
    },

    async delete(id) {
      return anchors.delete(id);
    }
  };
}
