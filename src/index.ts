import { IDL, Principal, query, StableBTreeMap, time, update} from 'azle';

const User = IDL.Record({
    id: IDL.Principal,
    createdAt: IDL.Nat64,
    campaignIds: IDL.Vec(IDL.Principal),
    username: IDL.Text
});

type User = {
    id: Principal;
    createdAt: bigint;
    campaignIds: Principal[];
    username: string;
};

const Campaign = IDL.Record({
    id: IDL.Principal,
    createdAt: IDL.Nat64,
    title: IDL.Text,
    description: IDL.Text,
    goalAmount: IDL.Nat64,
    amountRaised: IDL.Nat64,
    isFulfilled: IDL.Bool,
    contributors: IDL.Vec(IDL.Principal),
    userId: IDL.Principal
});

type Campaign = {
    id: Principal,
    createdAt: bigint;
    title: string,
    description: string,
    goalAmount: bigint,
    amountRaised: bigint,
    isFulfilled: boolean,
    contributors: Principal[],
    userId: Principal
};


export default class {
    users = new StableBTreeMap<Principal, User>(0);
    campaigns = new StableBTreeMap<Principal, Campaign>(1);
    // contributors = new StableBTreeMap<Principal, User>(2);

    // create user
    @update([IDL.Text], User)
    createUser(username: string): User {
        const id = generateId();
        const user: User = {
            id,
            createdAt: time(),
            campaignIds: [],
            username
        };

        this.users.insert(user.id, user);

        return user;
    }

    //search user by ID
    @query([IDL.Principal], IDL.Opt(User))
    readUserById(id: Principal): [User] | [] {
        const result = this.users.get(id);
        if (result === undefined) {
            return [];
        } else {
            return [result];
        }
    }

    //delete user
    @update([IDL.Principal], User)
    deleteUser(id: Principal): User {
        const user = this.users.get(id);

        if (user === undefined) {
            throw new Error(`User does not exist: ${id.toText()}`);
        }

        user.campaignIds.forEach((campaignId) => {
            this.campaigns.remove(campaignId);
        });

        this.users.remove(user.id);

        return user;
    }

    //create campaign
    @update([IDL.Text, IDL.Text, IDL.Nat64, IDL.Principal], Campaign)
    createCampaign(title: string, description: string, goalAmount: bigint, userId: Principal): Campaign {
        const user = this.users.get(userId);

        if (user === undefined) {
            throw new Error(`User does not exist: ${userId.toText()}`);
        }

        const id = generateId();
        const campaign: Campaign = {
            id,
            createdAt: time(),
            title,
            description,
            goalAmount,
            amountRaised: 0n,
            isFulfilled: false,
            contributors: [],
            userId
        }

        this.campaigns.insert(campaign.id, campaign);

        const updatedUser: User = {
            ...user,
            campaignIds: [...user.campaignIds, campaign.id]
        };

        this.users.insert(updatedUser.id, updatedUser);

        return campaign;
    }

    //get all campaigns
    @query([], IDL.Vec(Campaign))
    getCampaigns(): Campaign[] {
        return this.campaigns.values();
    }

    //search campaign
    @query([IDL.Principal], IDL.Opt(Campaign))
    getCampaignById(id: Principal): [Campaign] | [] {
        const result = this.campaigns.get(id);
        if (result === undefined) {
            return [];
        } else {
            return [result];
        }
    }

    //get campaign details
    @query([IDL.Principal], IDL.Opt(Campaign))
    getCampaignDetails(id: Principal): [string, string, bigint, bigint] | [] {
        const result = this.campaigns.get(id);
        if (result === undefined) {
            return [];
        } else {
            return [result?.title, result?.description, result?.amountRaised, result?.goalAmount];;
        }
    }

    // Donate to a campaign
    @update([IDL.Principal, IDL.Nat64], IDL.Opt(Campaign))
    donateToCampaign(id : Principal, amount : bigint): [Campaign] | [string] | [] {
        const campaign = this.campaigns.get(id);
        
        if (campaign === undefined) {
            return [];
        }

        // Ensure amount is positive
        if (amount <= 0n) {
            return ["amount must be positive"];
        }
        
        campaign.amountRaised += amount;

        // Note: In a real app, you would handle the actual ICP token transfer here.
        // For a portfolio MVP, simulating the amount increase is sufficient.

        this.campaigns.insert(id, campaign);
        return [campaign];
    }

    //delete campaign
    @update([IDL.Principal], Campaign)
    deletecampaign(id: Principal): Campaign {
        const campaign = this.campaigns.get(id);

        if (campaign === undefined) {
            throw new Error(`campaign does not exist: ${id.toText()}`);
        }

        const user = this.users.get(campaign.userId);

        if (user === undefined) {
            throw new Error(
                `User does not exist: ${campaign.userId.toText()}`
            );
        }

        const updatedUser: User = {
            ...user,
            campaignIds: user.campaignIds.filter(
                (campaignId) => campaignId.toText() !== campaign.id.toText()
            )
        };

        this.users.insert(updatedUser.id, updatedUser);

        this.campaigns.remove(id);

        return campaign;
    }
}

function generateId(): Principal{
    const randomBytes = new Array(29).fill(0).map((_) => Math.floor(Math.random() * 256));

    return Principal.fromUint8Array(Uint8Array.from(randomBytes));
}
