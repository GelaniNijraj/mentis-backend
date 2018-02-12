import mongoose from 'mongoose';
import validator from 'validator';

var Schema = mongoose.Schema;
var permissionSchema = new Schema({
	user: {type: Schema.Types.ObjectId, ref: 'User'},
	repo: {type: Schema.Types.ObjectId, ref: 'Repo'},
	canRead: Boolean,
	canWrite: Boolean
});

var Permission = mongoose.model('Permission', permissionSchema);

export default Permission;