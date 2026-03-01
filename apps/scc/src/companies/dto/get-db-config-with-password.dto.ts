import { IsString, IsUUID } from 'class-validator';

export class GetDbConfigWithPasswordDto {
  @IsUUID()
  companyId: string;

  @IsString()
  secret: string; // Secret-Token für zusätzliche Sicherheit (optional)
}
