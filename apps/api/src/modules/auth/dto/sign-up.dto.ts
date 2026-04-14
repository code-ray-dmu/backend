import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SignUpDto {
  @IsEmail()
    email: string;

  @IsString()
  @MinLength(4)
    password: string;

  @IsString()
  @IsNotEmpty()
    name: string;
}
