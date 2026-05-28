require('dotenv').config()

const crypto = require('crypto')
const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcrypt')

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('admin123', 10)

  const admin = await prisma.admins.create({
    data: {
      id: crypto.randomUUID(),
      email: 'admin@gmail.com',
      name: 'Administrator',
      password: hashedPassword,
    },
  })

  console.log('Admin berhasil dibuat!')
  console.log(admin)
}

main()
  .catch((e) => {
    console.error(e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })