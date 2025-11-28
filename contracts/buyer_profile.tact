import "@stdlib/deploy";
import "./message";

contract BuyerProfile with Deployable {
    
    collection_address: Address;
    collection_owner: Address?;
    collection_item_price: Int as uint32 = 0;
    owner: Address;
    is_initialized: Bool = false;
    is_whitelisted: Bool;
    enable_whitelist: Bool = false;
    user_item_limit: Int as uint8 = 0;
    user_item_count: Int as uint8 = 0;

    init (parent: Address, new_owner: Address) {
        self.collection_address = parent;
        self.owner = new_owner;
        self.is_whitelisted = false;
    }

    receive(msg: SetupCollectionData) {
        require(sender()==self.collection_address, "Parent Only");
        require(self.is_initialized == false, "Already setup");
        self.collection_owner = msg.collection_owner;
        self.collection_item_price = msg.collection_item_price;
        self.is_initialized = true;
        self.enable_whitelist = msg.enable_whitelist;
        self.user_item_limit = msg.user_item_limit
    }

    receive("Mint"){
        require(sender() == self.owner, "Profile owner only");
        if (self.enable_whitelist) {
           require(self.is_whitelisted() == true, "White list required");
        }
        if (self.user_item_limit > 0) {
            require(self.user_item_count < self.user_item_limit, "Mint limit per user reached");
        }
        let ctx: Context = context();
        require(ctx.value >= self.collection_item_price, "NFT creation underpriced");
        let msgValue: Int = ctx.value;
        let tonBalanceBeforeMsg: Int = myBalance() - msgValue;
        let storageFee: Int = minTonsForStorage - min(tonBalanceBeforeMsg, minTonsForStorage);
        msgValue = msgValue - (storageFee + gasConsumption);

        send(SendParameters{
            to: self.collection_address,
            value: msgValue,
            body: MintTo{
              owner: self.owner,
            }.toCell(),
            mode: SendIgnoreErrors
        });
        self.user_item_count = self.user_item_count + 1;
    }

    // Get whitelist status
    get fun is_whitelisted(): Bool {
        return self.is_whitelisted;
    }

    get fun user_mint_count(): Int {
        return self.user_item_count;
    }

    // List operations
    receive(msg: AddToWhiteList) {
        require(sender() == self.collection_address, "1"); // sender() == self.collection_owner
        self.is_whitelisted = msg.add;
    }

}
