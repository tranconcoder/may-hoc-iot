export default class AESTransfer {
	private pKey: BigInt;
	private gKey: number;
	private secretKey: number;

	public constructor() {
		this.pKey = BigInt(0);
		this.gKey = 0;
		this.secretKey = Math.floor(Math.random() * 1_000_000_000_000);
	}
}
