import {
  DeepPartial,
  EntityTarget,
  FindManyOptions,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { AppDataSource } from '../config/database';

export abstract class BaseRepository<T extends ObjectLiteral> {
  protected readonly entity: EntityTarget<T>;

  constructor(entity: EntityTarget<T>) {
    this.entity = entity;
  }

  protected get repo(): Repository<T> {
    return AppDataSource.getRepository(this.entity);
  }

  async findById(id: string): Promise<T | null> {
    return this.repo.findOneBy({ id } as unknown as FindOptionsWhere<T>);
  }

  async findOne(where: FindOptionsWhere<T>): Promise<T | null> {
    return this.repo.findOne({ where });
  }

  async find(options: FindManyOptions<T>): Promise<T[]> {
    return this.repo.find(options);
  }

  async create(data: DeepPartial<T>): Promise<T> {
    return this.repo.save(this.repo.create(data));
  }

  async save(entity: T): Promise<T> {
    return this.repo.save(entity);
  }

  async remove(entity: T): Promise<T> {
    return this.repo.remove(entity);
  }

  async count(where?: FindOptionsWhere<T>): Promise<number> {
    return this.repo.count(where ? { where } : {});
  }

  async exists(where: FindOptionsWhere<T>): Promise<boolean> {
    return this.repo.existsBy(where);
  }
}
