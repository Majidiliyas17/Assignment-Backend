import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUserStorageQuota1787252489000 implements MigrationInterface {
    name = 'AddUserStorageQuota1787252489000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "storage_quota_bytes" bigint NOT NULL DEFAULT '524288000'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "storage_quota_bytes"`);
    }

}