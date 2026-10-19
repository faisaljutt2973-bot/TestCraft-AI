CREATE TABLE "testcraft_records" (
	"collection" text,
	"id" text,
	"data" jsonb NOT NULL,
	CONSTRAINT "testcraft_records_pkey" PRIMARY KEY("collection","id")
);
