import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1786655820991 implements MigrationInterface {
    name = 'Init1786655820991'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."files_resource_type_enum" AS ENUM('auto', 'image', 'video', 'raw')`);
        await queryRunner.query(`CREATE TYPE "public"."files_visibility_enum" AS ENUM('private', 'public')`);
        await queryRunner.query(`CREATE TYPE "public"."files_status_enum" AS ENUM('pending', 'completed', 'failed')`);
        await queryRunner.query(`CREATE TABLE "files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "owner_id" uuid NOT NULL, "original_name" character varying(255) NOT NULL, "storage_key" character varying(255) NOT NULL, "cloudinary_public_id" character varying(255) NOT NULL, "resource_type" "public"."files_resource_type_enum" NOT NULL DEFAULT 'auto', "mime_type" character varying(255) NOT NULL, "extension" character varying(30) NOT NULL, "size" bigint NOT NULL, "visibility" "public"."files_visibility_enum" NOT NULL DEFAULT 'private', "share_token" character varying(64), "status" "public"."files_status_enum" NOT NULL DEFAULT 'pending', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4bc1db1f4f34ec9415acd88afd" ON "files" ("owner_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_249cfbc34729b150c5560299bf" ON "files" ("share_token") `);
        await queryRunner.query(`CREATE INDEX "IDX_c66506fd4a933e403dc80edd69" ON "files" ("created_at") `);
        await queryRunner.query(`CREATE INDEX "IDX_858dd7d1a5f2680af8d2fc3d9b" ON "files" ("owner_id", "created_at") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(120) NOT NULL, "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`ALTER TABLE "files" ADD CONSTRAINT "FK_4bc1db1f4f34ec9415acd88afdb" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "files" DROP CONSTRAINT "FK_4bc1db1f4f34ec9415acd88afdb"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_858dd7d1a5f2680af8d2fc3d9b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c66506fd4a933e403dc80edd69"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_249cfbc34729b150c5560299bf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4bc1db1f4f34ec9415acd88afd"`);
        await queryRunner.query(`DROP TABLE "files"`);
        await queryRunner.query(`DROP TYPE "public"."files_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."files_visibility_enum"`);
        await queryRunner.query(`DROP TYPE "public"."files_resource_type_enum"`);
    }

}
