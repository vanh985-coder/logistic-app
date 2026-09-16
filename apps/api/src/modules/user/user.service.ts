import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return (this.prisma as any).user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        companyId: true,
        createdAt: true,
      },
    });
  }

  async findOne(id: string) {
    // Calling findUnique on User. The Prisma extension automatically rewrites
    // this to findFirst with { id, companyId: context.companyId } if not PLATFORM_ADMIN.
    const user = await (this.prisma as any).user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        role: true,
        status: true,
        companyId: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID '${id}' not found`);
    }

    return user;
  }
}
