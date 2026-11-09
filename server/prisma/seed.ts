import { PrismaClient } from "@prisma/client";
import dayjs from "dayjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.media.deleteMany();
  await prisma.paperScan.deleteMany();
  await prisma.record.deleteMany();
  await prisma.carer.deleteMany();
  await prisma.baby.deleteMany();
  await prisma.family.deleteMany();

  const family = await prisma.family.create({
    data: {
      name: "我家",
      pin: process.env.FAMILY_PIN || "1234",
      carers: {
        create: [
          { name: "妈妈", role: "parent" },
          { name: "爸爸", role: "parent" },
          { name: "保姆", role: "nanny" },
        ],
      },
      babies: {
        create: [
          {
            name: "小宝",
            birthday: dayjs().subtract(10, "day").toDate(),
            gender: "unknown",
            notes: "示例宝宝，可在设置里改名",
          },
        ],
      },
    },
    include: { babies: true, carers: true },
  });

  const baby = family.babies[0];
  const mom = family.carers.find((c) => c.name === "妈妈")!;
  const nanny = family.carers.find((c) => c.name === "保姆")!;
  const today = dayjs().format("YYYY-MM-DD");

  await prisma.record.createMany({
    data: [
      {
        babyId: baby.id,
        carerId: nanny.id,
        type: "feeding",
        occurredAt: dayjs(`${today}T06:20:00`).toDate(),
        payload: JSON.stringify({
          method: "breast",
          leftMinutes: 12,
          rightMinutes: 8,
        }),
        note: "自己醒的",
        source: "manual",
      },
      {
        babyId: baby.id,
        carerId: nanny.id,
        type: "diaper",
        occurredAt: dayjs(`${today}T06:35:00`).toDate(),
        payload: JSON.stringify({ wet: true, dirty: false }),
        source: "manual",
      },
      {
        babyId: baby.id,
        carerId: mom.id,
        type: "feeding",
        occurredAt: dayjs(`${today}T09:40:00`).toDate(),
        payload: JSON.stringify({
          method: "bottle_formula",
          amountMl: 90,
        }),
        note: "配方奶",
        source: "manual",
      },
      {
        babyId: baby.id,
        carerId: nanny.id,
        type: "sleep",
        occurredAt: dayjs(`${today}T14:00:00`).toDate(),
        endAt: dayjs(`${today}T15:20:00`).toDate(),
        payload: JSON.stringify({ quality: "good" }),
        source: "manual",
      },
      {
        babyId: baby.id,
        carerId: mom.id,
        type: "growth",
        occurredAt: dayjs(`${today}T10:00:00`).toDate(),
        payload: JSON.stringify({
          weightKg: 3.6,
          heightCm: 52,
          headCm: 35.5,
        }),
        source: "manual",
      },
    ],
  });

  console.log("Seeded family:", family.name);
  console.log("Baby:", baby.name, baby.id);
  console.log("Carers:", family.carers.map((c) => c.name).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
