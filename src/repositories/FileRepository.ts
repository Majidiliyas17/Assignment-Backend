import { FileEntity } from '../entities/FileEntity';
import { BaseRepository } from './BaseRepository';

export interface FileListResult {
  files: FileEntity[];
  total: number;
}

export class FileRepository extends BaseRepository<FileEntity> {
  constructor() {
    super(FileEntity);
  }

  async findByOwnerId(ownerId: string, page: number, limit: number): Promise<FileListResult> {
    const [files, total] = await this.repo.findAndCount({
      where: { ownerId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { files, total };
  }

  async findByIdAndOwner(id: string, ownerId: string): Promise<FileEntity | null> {
    return this.findOne({ id, ownerId });
  }

  async findByShareToken(shareToken: string): Promise<FileEntity | null> {
    return this.findOne({ shareToken });
  }
}

export const fileRepository = new FileRepository();
