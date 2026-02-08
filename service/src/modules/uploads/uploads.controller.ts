import { Controller, Post, Req, UploadedFiles, UseGuards, UseInterceptors, Inject } from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Request } from "express";
import { UploadsService } from "./uploads.service";
import { AuthGuard } from "../auth/auth.guard";

@Controller("uploads")
@UseGuards(AuthGuard)
export class UploadsController {
  constructor(@Inject(UploadsService) private readonly uploadsService: UploadsService) {}

  @Post("images")
  @UseInterceptors(
    FilesInterceptor("file", 4, {
      limits: { fileSize: 10 * 1024 * 1024 }
    })
  )
  async uploadImages(
    @Req() request: Request,
    @UploadedFiles() files: Express.Multer.File[]
  ) {
    const result = await this.uploadsService.uploadImages(request, files);
    const traceId = request.headers["x-trace-id"] as string;
    return { ...result, traceId };
  }
}
