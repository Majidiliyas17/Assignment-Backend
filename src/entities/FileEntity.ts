import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from './UserEntity';
import { CloudinaryResourceType, FileStatus, FileVisibility } from '../enums';

@Entity('files')
@Index(['ownerId', 'createdAt'])
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => UserEntity, (user) => user.files, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: UserEntity;

  @Column({ type: 'varchar', length: 255, name: 'original_name' })
  originalName: string;

  @Column({ type: 'varchar', length: 255, name: 'storage_key' })
  storageKey: string;

  @Column({ type: 'varchar', length: 255, name: 'cloudinary_public_id' })
  cloudinaryPublicId: string;

  @Column({ type: 'enum', enum: CloudinaryResourceType, default: CloudinaryResourceType.AUTO, name: 'resource_type' })
  resourceType: CloudinaryResourceType;

  @Column({ type: 'varchar', length: 255, name: 'mime_type' })
  mimeType: string;

  @Column({ type: 'varchar', length: 30 })
  extension: string;

  @Column({
    type: 'bigint',
    transformer: {
      to: (value: number) => value,
      from: (value: string | number) => Number(value),
    },
  })
  size: number;

  @Column({ type: 'enum', enum: FileVisibility, default: FileVisibility.PRIVATE })
  visibility: FileVisibility;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, name: 'share_token', nullable: true })
  shareToken: string | null;

  @Column({ type: 'enum', enum: FileStatus, default: FileStatus.PENDING })
  status: FileStatus;

  @Index()
  @CreateDateColumn({ type: 'timestamp', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp', name: 'updated_at' })
  updatedAt: Date;
}