import axios from 'axios';
import mongoose from 'mongoose';
import { AppConfig } from 'config/App';
import { ethers } from 'ethers';
import { Token } from 'types/Token';
import { Vote } from 'types/Vote';
import { ERC20_READ } from 'utils/abi';
import { isValidAddress } from 'utils/web3';
import VoteModel from 'data/models/VoteModel';
import { DbConfig } from 'config/Db';

const dbOptions = {
  useNewUrlParser: true,
  useFindAndModify: true,
  useUnifiedTopology: true,
  useCreateIndex: true,
};

export default {
  GetTokenInfo,
  GetTokenBalance,
  CreateVote,
  GetVotes,
};

async function GetTokenInfo(address: string): Promise<Token | undefined> {
  if (!isValidAddress(address)) return;

  try {
    const result = await axios.get(
      `https://api.ethplorer.io/getTokenInfo/${address}?apiKey=${AppConfig.ETHPLORER_APIKEY}`
    );
    if (result.status !== 200) throw new Error("Couldn't retrieve token info");

    return toToken(result.data);
  } catch {
    console.error("Couldn't retrieve token info");
  }
}

async function GetTokenBalance(tokenAddress: string, address: string): Promise<number | undefined> {
  if (!isValidAddress(tokenAddress)) return;
  if (!isValidAddress(address)) return;

  const provider = ethers.getDefaultProvider();
  const erc20 = new ethers.Contract(tokenAddress, ERC20_READ, provider);

  try {
    const decimals = await erc20.decimals();
    const balance = await erc20.balanceOf(address);
    const etherUnit = ethers.utils.formatUnits(balance, decimals);

    return parseFloat(etherUnit);
  } catch {
    console.error("Couldn't retrieve token balance");
  }
}

async function CreateVote(vote: Vote): Promise<Vote | undefined> {
  try {
    await mongoose.connect(DbConfig.DB_CONNECTIONSTRING, dbOptions);

    return await VoteModel.create(vote);
  } catch (ex) {
    console.error(ex);
  } finally {
    await mongoose.disconnect();
  }
}

async function GetVotes(org: string, repo: string): Promise<Array<Vote>> {
  try {
    await mongoose.connect(DbConfig.DB_CONNECTIONSTRING, dbOptions);

    return await VoteModel.find({ org: org, repo: repo });
  } catch (ex) {
    console.error(ex);
  } finally {
    await mongoose.disconnect();
  }

  return [];
}

function toToken(source: any): Token {
  return {
    address: source.address,
    name: source.name,
    symbol: source.symbol,
    totalSupply: source.totalSupply,
    decimals: source.decimals,
    holdersCount: source.holdersCount,
    image: 'https://ethplorer.io/' + source.image,
    description: source.description,
    website: source.website,
  } as Token;
}
