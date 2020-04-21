import csvParse from 'csv-parse';
import { getCustomRepository, getRepository, In } from 'typeorm';
import fs from 'fs';

import Category from '../models/Category';
import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';
import AppError from '../errors/AppError';

interface CSVTransaction {
  title: string;

  type: 'income' | 'outcome';

  value: number;

  category: string;
}

class ImportTransactionsService {
  async execute(filepath: string): Promise<Transaction[]> {
    // TODO
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const contactsReadStream = fs.createReadStream(filepath, 'utf8');

    const parsers = csvParse({
      from_line: 2,
    });

    const categories: string[] = [];
    const transactions: CSVTransaction[] = [];

    const parseCSV = contactsReadStream.pipe(parsers);

    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parseCSV.on('end', resolve));

    const existentCategories = await categoriesRepository.find({
      where: { title: In(categories) },
    });

    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    const addCategoriesTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoriesTitles.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentCategories];

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    const existentBalance = await transactionsRepository.getBalance();

    const incomeBalance = createdTransactions.reduce(
      (accumulator, transaction) => {
        accumulator[transaction.type] += Number(transaction.value);
        return accumulator;
      },
      existentBalance,
    );

    const total = incomeBalance.income - incomeBalance.outcome;

    if (total < 0) {
      throw new AppError('You do not have enough balance');
    }

    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(filepath);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
