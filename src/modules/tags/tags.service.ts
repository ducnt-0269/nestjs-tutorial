import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class TagsService {
  constructor(private readonly prismaService: PrismaService) {}

  // Only the tags an article actually carries. Deleting the last article
  // holding a name leaves the row behind, and a name no reader can reach is
  // not a tag anyone can browse by.
  async list(): Promise<{ tags: string[] }> {
    const tags = await this.prismaService.tag.findMany({
      where: { articles: { some: {} } },
      orderBy: { name: 'asc' },
      select: { name: true },
    });

    return { tags: tags.map(({ name }) => name) };
  }

  // Two statements rather than a nested connectOrCreate: the insert carries
  // ON CONFLICT DO NOTHING, so two requests naming the same new tag both come
  // out with the row present instead of one of them breaking on the unique
  // index.
  async ensureIds(names: string[]): Promise<number[]> {
    if (names.length === 0) {
      return [];
    }

    await this.prismaService.tag.createMany({
      data: names.map((name) => ({ name })),
      skipDuplicates: true,
    });

    const tags = await this.prismaService.tag.findMany({
      where: { name: { in: names } },
      select: { id: true },
    });

    return tags.map((tag) => tag.id);
  }
}
