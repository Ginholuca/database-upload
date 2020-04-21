import { getCustomRepository } from 'typeorm';
import AppError from '../errors/AppError';

import TransactionsRepository from '../repositories/TransactionsRepository';

class DeleteTransactionService {
  public async execute(id: string): Promise<void> {
    // TODO
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const checkTransactionExists = await transactionsRepository.findOne(id);

    if (!checkTransactionExists) {
      throw new AppError('Transaction does not exists!', 404);
    }

    await transactionsRepository.delete(id);
  }
}

export default DeleteTransactionService;
