import { Test, TestingModule } from '@nestjs/testing';
import { BracketsController } from './brackets.controller';

describe('BracketsController', () => {
  let controller: BracketsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BracketsController],
    }).compile();

    controller = module.get<BracketsController>(BracketsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
