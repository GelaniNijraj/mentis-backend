import mongoose from 'mongoose';
import validator from 'validator';
import bcrypt from 'bcrypt';
import fs from 'fs';

var Schema = mongoose.Schema;
var issueReplySchema = new Schema({
	issue: {type: Schema.Types.ObjectId, ref: 'Issue'},
	from: {type: Schema.Types.ObjectId, ref: 'User'},
	postedOn: {type: Date, default: new Date()},
	description: {
		type: String,
		required: [true, 'description is required'],
		minlength: 1
	},
});

var IssueReply = mongoose.model('IssueReply', issueReplySchema);

export default IssueReply;